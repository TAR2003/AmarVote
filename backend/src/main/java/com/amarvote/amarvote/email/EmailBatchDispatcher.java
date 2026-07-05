package com.amarvote.amarvote.email;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.worker.EmailTask;
import com.amarvote.amarvote.service.TaskPublisherService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Buffers outbound emails and flushes at most one Resend API call per second per lane.
 * Batchable HTML emails are grouped (up to 100); attachment emails use a single-send slot.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailBatchDispatcher {

  private final EmailDeliveryGateway emailDeliveryGateway;
  private final EmailAddressValidator emailAddressValidator;
  private final TaskPublisherService taskPublisherService;

  private final ConcurrentLinkedDeque<PendingEmail> transactionalBatchable = new ConcurrentLinkedDeque<>();
  private final ConcurrentLinkedDeque<PendingEmail> transactionalSingle = new ConcurrentLinkedDeque<>();
  private final ConcurrentLinkedDeque<PendingEmail> bulkBatchable = new ConcurrentLinkedDeque<>();

  @Value("${amarvote.email.batch-size:100}")
  private int maxBatchSize;

  @Value("${amarvote.email.max-attempts:5}")
  private int maxAttempts;

  public void enqueue(EmailQueueType queueType, EmailMessage message, EmailTask sourceTask) {
  enqueueAll(queueType, List.of(message), sourceTask);
  }

  public void enqueueAll(EmailQueueType queueType, List<EmailMessage> messages, EmailTask sourceTask) {
    if (messages == null || messages.isEmpty()) {
      return;
    }

    for (EmailMessage message : messages) {
      if (message == null || message.getTo() == null) {
        log.warn("Skipping email with missing recipient (type={})", describeTask(sourceTask));
        continue;
      }

      String normalizedTo = emailAddressValidator.normalize(message.getTo());
      if (!emailAddressValidator.isValid(normalizedTo)) {
        log.error(
            "Rejected invalid email address before batch pool: {} (type={})",
            message.getTo(),
            describeTask(sourceTask));
        continue;
      }

      EmailMessage normalizedMessage =
          EmailMessage.builder()
              .to(normalizedTo)
              .subject(message.getSubject())
              .htmlContent(message.getHtmlContent())
              .attachments(message.getAttachments())
              .build();

      PendingEmail pending =
          new PendingEmail(normalizedMessage, sourceTask, 0, !normalizedMessage.getAttachments().isEmpty());

      if (queueType == EmailQueueType.BULK) {
        if (pending.hasAttachments()) {
          log.warn("Bulk queue does not support attachments; skipping {}", normalizedTo);
          continue;
        }
        bulkBatchable.addLast(pending);
      } else if (pending.hasAttachments()) {
        transactionalSingle.addLast(pending);
      } else {
        transactionalBatchable.addLast(pending);
      }
    }
  }

  @Scheduled(fixedRateString = "${amarvote.email.flush-interval-ms:1000}")
  public void flushTransactionalLane() {
    flushLane(EmailQueueType.TRANSACTIONAL);
  }

  @Scheduled(fixedRateString = "${amarvote.email.flush-interval-ms:1000}")
  public void flushBulkLane() {
    flushLane(EmailQueueType.BULK);
  }

  private void flushLane(EmailQueueType queueType) {
    int batchLimit = Math.min(Math.max(maxBatchSize, 1), ResendEmailSender.MAX_BATCH_SIZE);

    if (queueType == EmailQueueType.TRANSACTIONAL) {
      PendingEmail single = transactionalSingle.pollFirst();
      if (single != null) {
        deliverSingleWithRecovery(queueType, single);
        return;
      }

      List<PendingEmail> batch = drainUpTo(transactionalBatchable, batchLimit);
      if (!batch.isEmpty()) {
        deliverBatchWithRecovery(queueType, batch);
      }
      return;
    }

    List<PendingEmail> batch = drainUpTo(bulkBatchable, batchLimit);
    if (!batch.isEmpty()) {
      deliverBatchWithRecovery(queueType, batch);
    }
  }

  private List<PendingEmail> drainUpTo(ConcurrentLinkedDeque<PendingEmail> deque, int limit) {
    List<PendingEmail> batch = new ArrayList<>(Math.min(limit, deque.size()));
    for (int i = 0; i < limit; i++) {
      PendingEmail item = deque.pollFirst();
      if (item == null) {
        break;
      }
      batch.add(item);
    }
    return batch;
  }

  private void deliverSingleWithRecovery(EmailQueueType queueType, PendingEmail pending) {
    try {
      emailDeliveryGateway.deliver(queueType, pending.message());
    } catch (RuntimeException ex) {
      handleDeliveryFailure(queueType, List.of(pending), ex);
    }
  }

  private void deliverBatchWithRecovery(EmailQueueType queueType, List<PendingEmail> batch) {
    List<EmailMessage> messages = batch.stream().map(PendingEmail::message).toList();
    try {
      emailDeliveryGateway.deliverBatch(queueType, messages);
      log.debug("Sent batch of {} email(s) on {} lane", messages.size(), queueType);
    } catch (RuntimeException ex) {
      handleDeliveryFailure(queueType, batch, ex);
    }
  }

  private void handleDeliveryFailure(
      EmailQueueType queueType, List<PendingEmail> batch, RuntimeException ex) {
    EmailDeliveryException deliveryException =
        ex instanceof EmailDeliveryException wrapped
            ? wrapped
            : EmailDeliveryException.wrap(ex);

    if (deliveryException.isRateLimited()) {
      log.warn(
          "Rate limited on {} lane — re-queuing {} email(s) for next tick",
          queueType,
          batch.size());
      requeueToFront(queueType, batch);
      return;
    }

    if (batch.size() == 1) {
      PendingEmail failed = batch.get(0);
      int nextAttempt = failed.attempt() + 1;
      if (nextAttempt >= maxAttempts) {
        log.error(
            "Email permanently failed after {} attempts — to={}, type={}",
            maxAttempts,
            failed.message().getTo(),
            describeTask(failed.sourceTask()));
        republishToDlq(failed.sourceTask(), nextAttempt);
        return;
      }

      log.warn(
          "Retrying single email (attempt {}/{}) — to={}, reason={}",
          nextAttempt,
          maxAttempts,
          failed.message().getTo(),
          deliveryException.getMessage());
      requeueToFront(
          queueType, List.of(new PendingEmail(failed.message(), failed.sourceTask(), nextAttempt, failed.hasAttachments())));
      return;
    }

    int mid = batch.size() / 2;
    List<PendingEmail> firstHalf = new ArrayList<>(batch.subList(0, mid));
    List<PendingEmail> secondHalf = new ArrayList<>(batch.subList(mid, batch.size()));
    log.warn(
        "Batch of {} failed on {} lane — splitting into {} + {} for isolated retry",
        batch.size(),
        queueType,
        firstHalf.size(),
        secondHalf.size());
    requeueToFront(queueType, secondHalf);
    requeueToFront(queueType, firstHalf);
  }

  private void requeueToFront(EmailQueueType queueType, List<PendingEmail> items) {
    if (items == null || items.isEmpty()) {
      return;
    }

    ConcurrentLinkedDeque<PendingEmail> target =
        switch (queueType) {
          case TRANSACTIONAL -> {
            if (items.get(0).hasAttachments()) {
              yield transactionalSingle;
            }
            yield transactionalBatchable;
          }
          case BULK -> bulkBatchable;
        };

    for (int i = items.size() - 1; i >= 0; i--) {
      target.addFirst(items.get(i));
    }
  }

  private void republishToDlq(EmailTask sourceTask, int attempt) {
    if (sourceTask == null) {
      return;
    }
    EmailTask copy = cloneTask(sourceTask);
    copy.setAttempt(attempt);
    taskPublisherService.publishEmailTaskToDlq(copy);
  }

  private EmailTask cloneTask(EmailTask task) {
    return EmailTask.builder()
        .emailType(task.getEmailType())
        .toEmail(task.getToEmail())
        .toEmails(task.getToEmails() == null ? null : new ArrayList<>(task.getToEmails()))
        .token(task.getToken())
        .code(task.getCode())
        .resetLink(task.getResetLink())
        .electionTitle(task.getElectionTitle())
        .electionDescription(task.getElectionDescription())
        .privateKey(task.getPrivateKey())
        .electionId(task.getElectionId())
        .credentialFilePath(task.getCredentialFilePath())
        .trackingCode(task.getTrackingCode())
        .receiptContent(task.getReceiptContent())
        .receiptDownloadToken(task.getReceiptDownloadToken())
        .siteBaseUrl(task.getSiteBaseUrl())
        .subject(task.getSubject())
        .htmlContent(task.getHtmlContent())
        .attempt(task.getAttempt())
        .build();
  }

  private static String describeTask(EmailTask task) {
    if (task == null || task.getEmailType() == null) {
      return "unknown";
    }
    return task.getEmailType().name();
  }

  /** Exposed for monitoring/tests. */
  public int pendingCount(EmailQueueType queueType) {
    return switch (queueType) {
      case TRANSACTIONAL -> transactionalBatchable.size() + transactionalSingle.size();
      case BULK -> bulkBatchable.size();
    };
  }

  private record PendingEmail(
      EmailMessage message, EmailTask sourceTask, int attempt, boolean hasAttachments) {}
}

package com.amarvote.amarvote.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.VoteReceipt;

public interface VoteReceiptRepository extends JpaRepository<VoteReceipt, UUID> {}

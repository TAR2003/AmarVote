import React, { useCallback, useEffect, useState } from 'react';
import { FiMail, FiTrash2, FiEdit2, FiClock, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { electionApi } from '../utils/electionApi';
import { timezoneUtils } from '../utils/timezoneUtils';

const VOTER_FILTERS = [
  { value: 'both', label: 'All voters (voted and not voted)' },
  { value: 'voted', label: 'Voters who submitted their vote' },
  { value: 'not_voted', label: 'Voters who have not voted yet' },
];

const RECIPIENT_GROUPS = [
  { value: 'voters', label: 'Voters' },
  { value: 'guardians', label: 'Guardians' },
  { value: 'admins', label: 'Admins & Co-Admins' },
];

function buildEmailTemplate(electionData, group) {
  const title = electionData?.electionTitle || 'Election';
  const description = electionData?.electionDescription || '';
  const electionLink = `${window.location.origin}/election-page/${electionData?.electionId}`;

  if (group === 'guardians') {
    return [
      'Dear guardian,',
      '',
      `This is a message regarding the election "${title}" where you serve as a guardian.`,
      '',
      `Election description:\n${description}`,
      '',
      `Election page: ${electionLink}`,
      '',
      'Please complete any pending guardian duties for this election.',
      '',
      'Regards,',
      'AmarVote Team',
    ].join('\n');
  }

  if (group === 'admins') {
    return [
      'Dear election administrator,',
      '',
      `This is a message regarding the election "${title}" that you administer.`,
      '',
      `Election description:\n${description}`,
      '',
      `Election page: ${electionLink}`,
      '',
      'Please review the election dashboard for any pending actions.',
      '',
      'Regards,',
      'AmarVote Team',
    ].join('\n');
  }

  return [
    'Dear voter,',
    '',
    `This is a message regarding the election "${title}".`,
    '',
    `Election description:\n${description}`,
    '',
    `Election page: ${electionLink}`,
    '',
    'Please cast your vote within the election window.',
    '',
    'Regards,',
    'AmarVote Team',
  ].join('\n');
}

function formatDateTime(value) {
  if (!value) return '—';
  return timezoneUtils.formatDateTime(value);
}

function toLocalInputValue(isoString) {
  return timezoneUtils.toLocalInputValue(isoString);
}

export default function ScheduledEmailTab({ electionId, electionData }) {
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    recipientGroup: 'voters',
    voterFilter: 'both',
    emailBody: '',
    scheduledTime: '',
  });

  const loadScheduledEmails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await electionApi.listScheduledEmails(electionId);
      setScheduledEmails(response.scheduledEmails || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    loadScheduledEmails();
  }, [loadScheduledEmails]);

  useEffect(() => {
    if (!editingId && electionData) {
      setForm((prev) => ({
        ...prev,
        emailBody: buildEmailTemplate(electionData, prev.recipientGroup),
      }));
    }
  }, [electionData, editingId]);

  const handleGroupChange = (group) => {
    setForm((prev) => ({
      ...prev,
      recipientGroup: group,
      emailBody: buildEmailTemplate(electionData, group),
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      recipientGroup: 'voters',
      voterFilter: 'both',
      emailBody: buildEmailTemplate(electionData, 'voters'),
      scheduledTime: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.emailBody.trim()) {
      toast.error('Email body is required');
      return;
    }
    if (!form.scheduledTime) {
      toast.error('Scheduled time is required');
      return;
    }

    const payload = {
      recipientGroup: form.recipientGroup,
      voterFilter: form.recipientGroup === 'voters' ? form.voterFilter : 'both',
      emailBody: form.emailBody.trim(),
      scheduledTime: new Date(form.scheduledTime).toISOString(),
    };

    try {
      setSaving(true);
      if (editingId) {
        await electionApi.updateScheduledEmail(electionId, editingId, payload);
        toast.success('Scheduled email updated');
      } else {
        await electionApi.createScheduledEmail(electionId, payload);
        toast.success('Email scheduled successfully');
      }
      resetForm();
      await loadScheduledEmails();
    } catch (err) {
      toast.error(err.message || 'Failed to save scheduled email');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (email) => {
    if (email.sent) return;
    setEditingId(email.emailId);
    setForm({
      recipientGroup: email.recipientGroup,
      voterFilter: email.voterFilter || 'both',
      emailBody: email.emailBody,
      scheduledTime: toLocalInputValue(email.scheduledTime),
    });
  };

  const handleDelete = async (emailId) => {
    if (!window.confirm('Delete this scheduled email?')) return;
    try {
      await electionApi.deleteScheduledEmail(electionId, emailId);
      toast.success('Scheduled email deleted');
      if (editingId === emailId) {
        resetForm();
      }
      await loadScheduledEmails();
    } catch (err) {
      toast.error(err.message || 'Failed to delete scheduled email');
    }
  };

  const groupLabel = (value) =>
    RECIPIENT_GROUPS.find((g) => g.value === value)?.label || value;

  const voterFilterLabel = (value) =>
    VOTER_FILTERS.find((f) => f.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-2 flex items-center">
          <FiMail className="h-5 w-5 mr-2" />
          {editingId ? 'Edit Scheduled Email' : 'Schedule Email'}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose an audience group and schedule a message. Recipients are resolved from the current
          list when the scheduled time arrives (not when you create the schedule).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Send to</label>
            <div className="flex flex-wrap gap-3">
              {RECIPIENT_GROUPS.map((group) => (
                <label key={group.value} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="recipientGroup"
                    value={group.value}
                    checked={form.recipientGroup === group.value}
                    onChange={() => handleGroupChange(group.value)}
                    className="form-radio text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{group.label}</span>
                </label>
              ))}
            </div>
          </div>

          {form.recipientGroup === 'voters' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voter audience</label>
              <div className="space-y-2">
                {VOTER_FILTERS.map((filter) => (
                  <label key={filter.value} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="voterFilter"
                      value={filter.value}
                      checked={form.voterFilter === filter.value}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, voterFilter: filter.value }))
                      }
                      className="form-radio text-blue-600 mt-1"
                    />
                    <span className="text-sm text-gray-700">{filter.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={form.emailBody}
              onChange={(e) => setForm((prev) => ({ ...prev, emailBody: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-40"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send at</label>
            <input
              type="datetime-local"
              value={form.scheduledTime}
              onChange={(e) => setForm((prev) => ({ ...prev, scheduledTime: e.target.value }))}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Schedule' : 'Schedule Email'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">Scheduled & Sent Emails</h3>

        {loading ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : scheduledEmails.length === 0 ? (
          <p className="text-sm text-gray-600">No scheduled emails yet.</p>
        ) : (
          <div className="space-y-3">
            {scheduledEmails.map((email) => (
              <div
                key={email.emailId}
                className={`rounded-lg border p-4 ${
                  email.sent ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {email.sent ? (
                        <FiCheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <FiClock className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="font-medium text-gray-900">
                        {groupLabel(email.recipientGroup)}
                        {email.recipientGroup === 'voters' && email.voterFilter && email.voterFilter !== 'both' && (
                          <span className="text-gray-500 font-normal">
                            {' '}
                            · {voterFilterLabel(email.voterFilter)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          email.sent
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {email.sent ? 'Sent' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Scheduled: {formatDateTime(email.scheduledTime)}
                      {email.sentAt && ` · Sent: ${formatDateTime(email.sentAt)}`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {!email.sent && (
                      <button
                        type="button"
                        onClick={() => handleEdit(email)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                        title="Edit"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(email.emailId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <pre className="mt-3 text-xs whitespace-pre-wrap text-gray-700 bg-white border border-gray-100 rounded p-3 max-h-32 overflow-y-auto">
                  {email.emailBody}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

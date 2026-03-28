import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUpload,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import {
  createAuthorizedUser,
  deleteAuthorizedUser,
  getAuthorizedUserAuditLogs,
  getAuthorizedUsers,
  updatePermissionSettings,
  updateAuthorizedUser,
  uploadAuthorizedUsersCsv,
} from "../utils/api";

const AuthenticatedUsers = () => {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [currentUserType, setCurrentUserType] = useState("user");
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({
    registrationOpenToAll: false,
    electionCreationPermissionScope: "all_admins_owners",
  });

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserType, setNewUserType] = useState("user");

  const loadAll = async () => {
    try {
      setLoading(true);
      const [usersData, auditData] = await Promise.all([
        getAuthorizedUsers(),
        getAuthorizedUserAuditLogs().catch(() => ({ logs: [] })),
      ]);

      setCanManage(!!usersData.canManage);
      setCurrentUserType(usersData.currentUserType || "user");
      setUsers(Array.isArray(usersData.users) ? usersData.users : []);
      setSettings(usersData.settings || {
        registrationOpenToAll: false,
        electionCreationPermissionScope: "all_admins_owners",
      });
      setAuditLogs(Array.isArray(auditData.logs) ? auditData.logs : []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load authenticated users data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      `${u.email} ${u.userType} ${u.registeredOrNot ? "registered" : "not registered"}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  const canAssignOwner = currentUserType === "owner";

  const handlePermissionSettingsSave = async () => {
    if (!canManage) return;
    try {
      const updated = await updatePermissionSettings({
        registrationOpenToAll: !!settings.registrationOpenToAll,
        electionCreationPermissionScope: settings.electionCreationPermissionScope,
      });
      setSettings(updated);
      setSuccess("Permission settings updated.");
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to update permission settings.");
    }
  };

  const handleRoleChange = async (row, nextType) => {
    if (!canManage || !row.canEdit) return;

    try {
      setSavingId(row.authorizedUserId);
      await updateAuthorizedUser(row.authorizedUserId, {
        email: row.email,
        userType: nextType,
      });
      setSuccess(`Updated role for ${row.email}`);
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to update role.");
    } finally {
      setSavingId(null);
    }
  };

  const handleCanCreateElectionsChange = async (row, nextValue) => {
    if (!canManage || !row.canEdit) return;
    try {
      setSavingId(row.authorizedUserId);
      await updateAuthorizedUser(row.authorizedUserId, {
        email: row.email,
        userType: row.userType,
        canCreateElections: nextValue,
      });
      setSuccess(`Updated election-creation permission for ${row.email}`);
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to update can-create-elections flag.");
    } finally {
      setSavingId(null);
    }
  };

  const handleApiLogViewerAllowedChange = async (row, nextValue) => {
    if (!canManage || !row.canEdit) return;
    try {
      setSavingId(row.authorizedUserId);
      await updateAuthorizedUser(row.authorizedUserId, {
        email: row.email,
        userType: row.userType,
        canCreateElections: row.canCreateElections,
        apiLogViewerAllowed: nextValue,
      });
      setSuccess(`Updated API log viewer permission for ${row.email}`);
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to update API log viewer permission.");
    } finally {
      setSavingId(null);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      await createAuthorizedUser({
        email: newUserEmail,
        userType: newUserType,
      });
      setNewUserEmail("");
      setNewUserType("user");
      setSuccess("User added to authenticated users list.");
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to add user.");
    }
  };

  const handleDeleteUser = async (row) => {
    if (!canManage || !row.canEdit) return;
    const confirmed = window.confirm(`Remove ${row.email} from authorized users list?`);
    if (!confirmed) return;

    try {
      setDeletingId(row.authorizedUserId);
      await deleteAuthorizedUser(row.authorizedUserId);
      setSuccess(`Removed ${row.email}`);
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to remove user.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !canManage) return;

    try {
      setUploadingCsv(true);
      const result = await uploadAuthorizedUsersCsv(file);
      setSuccess(`CSV processed: added ${result.created || 0}, skipped ${result.skipped || 0}`);
      await loadAll();
    } catch (err) {
      setError(err.message || "CSV upload failed.");
    } finally {
      setUploadingCsv(false);
      event.target.value = "";
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FiUsers className="h-6 w-6" />
                Authenticated Users
              </h1>
              <p className="text-sm text-blue-100 mt-1">
                Viewable by all logged-in users. Managed by admin and owner.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="mt-4 text-xs text-blue-100 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span>Current role: {currentUserType}</span>
            <span>Can manage: {canManage ? "Yes" : "No"}</span>
          </div>
        </div>

        <div className="p-5 border-b border-gray-200 space-y-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by email or role..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
          </div>

          {canManage ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs text-gray-600 mb-1">Add User Email</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Role</label>
                  <select
                    value={newUserType}
                    onChange={(e) => setNewUserType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    {canAssignOwner ? <option value="owner">owner</option> : null}
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <FiUserPlus className="h-4 w-4" /> Add
                </button>
              </form>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Bulk Add via CSV</label>
                <label className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-50">
                  <FiUpload className="h-4 w-4" />
                  {uploadingCsv ? "Uploading..." : "Upload CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {canManage ? (
            <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <h3 className="text-sm font-semibold text-indigo-800 mb-2">Permission Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-indigo-700 mb-1">Permission to Register</label>
                  <select
                    value={settings.registrationOpenToAll ? "all" : "authenticated"}
                    onChange={(e) => setSettings((prev) => ({
                      ...prev,
                      registrationOpenToAll: e.target.value === "all",
                    }))}
                    className="w-full rounded-lg border border-indigo-300 px-2.5 py-2 text-sm"
                  >
                    <option value="all">Allow all emails</option>
                    <option value="authenticated">Allow only authenticated users</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-indigo-700 mb-1">Permission to Create Elections</label>
                  <select
                    value={settings.electionCreationPermissionScope || "all_admins_owners"}
                    onChange={(e) => setSettings((prev) => ({
                      ...prev,
                      electionCreationPermissionScope: e.target.value,
                    }))}
                    className="w-full rounded-lg border border-indigo-300 px-2.5 py-2 text-sm"
                  >
                    <option value="all_users">All users</option>
                    <option value="all_authenticated_users">All authenticated users</option>
                    <option value="all_admins_owners">All admins and owners</option>
                    <option value="owner">Owner only</option>
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={handlePermissionSettingsSave}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  Save Permission Settings
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="m-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
            <FiAlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="m-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm flex items-center gap-2">
            <FiCheckCircle className="h-4 w-4" />
            <span>{success}</span>
          </div>
        ) : null}

        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">No users match your search.</div>
          ) : (
            filteredUsers.map((row) => {
              const busy = savingId === row.authorizedUserId || deletingId === row.authorizedUserId;
              const rowEditable = canManage && row.canEdit;

              return (
                <div key={row.authorizedUserId} className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-semibold text-gray-900 break-all">{row.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">User Type</p>
                      {rowEditable ? (
                        <select
                          disabled={busy}
                          value={row.userType}
                          onChange={(e) => handleRoleChange(row, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          {canAssignOwner ? <option value="owner">owner</option> : null}
                        </select>
                      ) : (
                        <span className={`inline-flex text-xs px-2 py-1 rounded-full ${row.userType === "owner" ? "bg-purple-100 text-purple-700" : row.userType === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                          {row.userType}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Registered</p>
                      <span className={`inline-flex text-xs px-2 py-1 rounded-full ${row.registeredOrNot ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                        {row.registeredOrNot ? "Registered" : "Not Registered"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">API Log Viewer Allowed</p>
                      {rowEditable ? (
                        <select
                          disabled={busy}
                          value={row.apiLogViewerAllowed ? "yes" : "no"}
                          onChange={(e) => handleApiLogViewerAllowedChange(row, e.target.value === "yes")}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : (
                        <span className={`inline-flex text-xs px-2 py-1 rounded-full ${row.apiLogViewerAllowed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                          {row.apiLogViewerAllowed ? "Yes" : "No"}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Can Create Elections</p>
                      {rowEditable ? (
                        <select
                          disabled={busy}
                          value={row.canCreateElections ? "yes" : "no"}
                          onChange={(e) => handleCanCreateElectionsChange(row, e.target.value === "yes")}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : (
                        <span className={`inline-flex text-xs px-2 py-1 rounded-full ${row.canCreateElections ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                          {row.canCreateElections ? "Yes" : "No"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Last Active</p>
                    <p className="text-sm text-gray-700">{row.lastActive ? new Date(row.lastActive).toLocaleString() : "-"}</p>
                  </div>

                  <div>
                    {rowEditable ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteUser(row)}
                        className="inline-flex items-center justify-center gap-1 w-full px-2.5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Read only</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">API Log Viewer Allowed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">User Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Can Create Elections</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Last Active</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-gray-500 text-center">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-gray-500 text-center">No users match your search.</td>
                </tr>
              ) : (
                filteredUsers.map((row) => {
                  const busy = savingId === row.authorizedUserId || deletingId === row.authorizedUserId;
                  const rowEditable = canManage && row.canEdit;

                  return (
                    <tr key={row.authorizedUserId} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.email}</td>

                      <td className="px-4 py-3">
                        {rowEditable ? (
                          <select
                            disabled={busy}
                            value={row.apiLogViewerAllowed ? "yes" : "no"}
                            onChange={(e) => handleApiLogViewerAllowedChange(row, e.target.value === "yes")}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${row.apiLogViewerAllowed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {row.apiLogViewerAllowed ? "Yes" : "No"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${row.registeredOrNot ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                          {row.registeredOrNot ? "Registered" : "Not Registered"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {rowEditable ? (
                          <select
                            disabled={busy}
                            value={row.userType}
                            onChange={(e) => handleRoleChange(row, e.target.value)}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            {canAssignOwner ? <option value="owner">owner</option> : null}
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${row.userType === "owner" ? "bg-purple-100 text-purple-700" : row.userType === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                            {row.userType}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {rowEditable ? (
                          <select
                            disabled={busy}
                            value={row.canCreateElections ? "yes" : "no"}
                            onChange={(e) => handleCanCreateElectionsChange(row, e.target.value === "yes")}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${row.canCreateElections ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                            {row.canCreateElections ? "Yes" : "No"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-700">{row.lastActive ? new Date(row.lastActive).toLocaleString() : "-"}</td>

                      <td className="px-4 py-3">
                        {rowEditable ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDeleteUser(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Read only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FiShield className="h-4 w-4" />
            Admin/Owner Action Logs
          </h2>
          <p className="text-xs text-gray-500 mt-1">Recent actions: add, remove, role changes, and permission updates.</p>
        </div>

        <div className="md:hidden divide-y divide-gray-100">
          {!canManage ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">Only admin and owner can view action history.</div>
          ) : auditLogs.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">No actions logged yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.auditLogId} className="p-4 space-y-2">
                <div className="text-xs text-gray-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</div>
                <div className="text-sm font-semibold text-gray-900 break-words">{log.actionType}</div>
                <div className="text-sm text-gray-700 break-all">Actor: {log.actorEmail || "-"}</div>
                <div className="text-sm text-gray-700 break-all">Target: {log.targetEmail || "-"}</div>
                <div className="text-sm text-gray-700">{log.details || "-"}</div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {!canManage ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-gray-500 text-center">Only admin and owner can view action history.</td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-gray-500 text-center">No actions logged yet.</td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.auditLogId} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-sm text-gray-700">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{log.actionType}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.actorEmail}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.targetEmail}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.details || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuthenticatedUsers;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUpload,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import {
  bulkDeleteAuthorizedUsers,
  createAuthorizedUser,
  getAuthorizedUserAuditLogs,
  getAuthorizedUsers,
  updatePermissionSettings,
  updateAuthorizedUser,
  uploadAuthorizedUsersCsv,
} from "../utils/api";
import { timezoneUtils } from "../utils/timezoneUtils";

const PAGE_SIZE = 50;
const ROLE_OPTIONS = [
  { id: "user", label: "User" },
  { id: "admin", label: "Admin" },
  { id: "owner", label: "Owner" },
];

const AuthenticatedUsers = () => {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState("users");
  const [canManage, setCanManage] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentUserType, setCurrentUserType] = useState("user");

  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersHasNext, setUsersHasNext] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilters, setRoleFilters] = useState({ user: true, admin: true, owner: true });
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  const [auditLogs, setAuditLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsHasNext, setLogsHasNext] = useState(false);
  const [logsSearchInput, setLogsSearchInput] = useState("");
  const [appliedLogsSearch, setAppliedLogsSearch] = useState("");

  const [settings, setSettings] = useState({
    registrationOpenToAll: false,
    electionCreationPermissionScope: "all_admins_owners",
  });

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserType, setNewUserType] = useState("user");

  const selectedUserTypes = useMemo(
    () => ROLE_OPTIONS.filter(({ id }) => roleFilters[id]).map(({ id }) => id),
    [roleFilters]
  );
  const noRoleFiltersSelected = selectedUserTypes.length === 0;

  const loadUsers = useCallback(async (page = usersPage) => {
    if (noRoleFiltersSelected) {
      setUsers([]);
      setUsersTotal(0);
      setUsersHasNext(false);
      setSelectedUserIds(new Set());
      return;
    }

    const data = await getAuthorizedUsers({
      page,
      size: PAGE_SIZE,
      search: appliedSearch,
      userTypes: selectedUserTypes.length < ROLE_OPTIONS.length ? selectedUserTypes : undefined,
    });

    setCanManage(!!data.canManage);
    setCurrentUserType(data.currentUserType || "user");
    setUsers(Array.isArray(data.users) ? data.users : []);
    setSettings(data.settings || {
      registrationOpenToAll: false,
      electionCreationPermissionScope: "all_admins_owners",
    });
    setUsersPage(data.page ?? page);
    setUsersTotal(data.totalElements ?? 0);
    setUsersHasNext(!!data.hasNext);
    setSelectedUserIds(new Set());
  }, [appliedSearch, noRoleFiltersSelected, selectedUserTypes, usersPage]);

  const loadAuditLogs = useCallback(async (page = logsPage) => {
    const data = await getAuthorizedUserAuditLogs({
      page,
      size: PAGE_SIZE,
      search: appliedLogsSearch,
    });

    setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
    setLogsPage(data.page ?? page);
    setLogsTotal(data.totalElements ?? 0);
    setLogsHasNext(!!data.hasNext);
  }, [appliedLogsSearch, logsPage]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === "users") {
        await loadUsers(usersPage);
      } else {
        await loadAuditLogs(logsPage);
      }
      setError("");
    } catch (err) {
      const message = err.message || "Failed to load authenticated users data.";
      if (/access denied|admin or owner|forbidden|not allowed/i.test(message)) {
        setAccessDenied(true);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadAuditLogs, loadUsers, logsPage, usersPage]);

  useEffect(() => {
    loadAll();
  }, [activeTab, appliedSearch, appliedLogsSearch, usersPage, logsPage, selectedUserTypes]);

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

  const canAssignOwner = currentUserType === "owner";
  const selectableUsers = useMemo(
    () => users.filter((row) => canManage && row.canEdit),
    [users, canManage]
  );
  const allSelectableSelected = selectableUsers.length > 0
    && selectableUsers.every((row) => selectedUserIds.has(row.authorizedUserId));

  const handleUserSearch = (e) => {
    e.preventDefault();
    setUsersPage(0);
    setAppliedSearch(searchInput.trim());
  };

  const handleLogsSearch = (e) => {
    e.preventDefault();
    setLogsPage(0);
    setAppliedLogsSearch(logsSearchInput.trim());
  };

  const toggleRoleFilter = (roleId) => {
    setRoleFilters((prev) => ({ ...prev, [roleId]: !prev[roleId] }));
    setUsersPage(0);
  };

  const toggleUserSelection = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllUsers = () => {
    if (allSelectableSelected) {
      setSelectedUserIds(new Set());
      return;
    }
    setSelectedUserIds(new Set(selectableUsers.map((row) => row.authorizedUserId)));
  };

  const handleBulkDelete = async () => {
    if (!canManage || selectedUserIds.size === 0) return;
    const confirmed = window.confirm(`Remove ${selectedUserIds.size} selected user(s) from authorized users and delete their accounts if registered?`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      const result = await bulkDeleteAuthorizedUsers([...selectedUserIds]);
      setSuccess(`Removed ${result.removed || 0} user(s)${result.skipped ? `, skipped ${result.skipped}` : ""}.`);
      await loadUsers(0);
      setUsersPage(0);
    } catch (err) {
      setError(err.message || "Failed to remove selected users.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePermissionSettingsSave = async () => {
    if (!canManage) return;
    try {
      const updated = await updatePermissionSettings({
        registrationOpenToAll: !!settings.registrationOpenToAll,
        electionCreationPermissionScope: settings.electionCreationPermissionScope,
      });
      setSettings(updated);
      setSuccess("Permission settings updated.");
      await loadUsers(usersPage);
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
      await loadUsers(usersPage);
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
      await loadUsers(usersPage);
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
      await loadUsers(usersPage);
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
      await createAuthorizedUser({ email: newUserEmail, userType: newUserType });
      setNewUserEmail("");
      setNewUserType("user");
      setSuccess("User added to authenticated users list.");
      setUsersPage(0);
      await loadUsers(0);
    } catch (err) {
      setError(err.message || "Failed to add user.");
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !canManage) return;
    try {
      setUploadingCsv(true);
      const result = await uploadAuthorizedUsersCsv(file);
      setSuccess(`CSV processed: added ${result.created || 0}, skipped ${result.skipped || 0}`);
      setUsersPage(0);
      await loadUsers(0);
    } catch (err) {
      setError(err.message || "CSV upload failed.");
    } finally {
      setUploadingCsv(false);
      event.target.value = "";
    }
  };

  const usersRangeStart = usersTotal === 0 ? 0 : usersPage * PAGE_SIZE + 1;
  const usersRangeEnd = Math.min((usersPage + 1) * PAGE_SIZE, usersTotal);
  const logsRangeStart = logsTotal === 0 ? 0 : logsPage * PAGE_SIZE + 1;
  const logsRangeEnd = Math.min((logsPage + 1) * PAGE_SIZE, logsTotal);

  const renderUserRow = (row, mobile = false) => {
    const busy = savingId === row.authorizedUserId || deleting;
    const rowEditable = canManage && row.canEdit;
    const isSelected = selectedUserIds.has(row.authorizedUserId);

    if (mobile) {
      return (
        <div key={row.authorizedUserId} className="p-4 space-y-3">
          {canManage ? (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!rowEditable || busy}
                onChange={() => toggleUserSelection(row.authorizedUserId)}
                className="rounded border-gray-300"
              />
              Select
            </label>
          ) : null}
          <div>
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-sm font-semibold text-ink break-all">{row.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">User Type</p>
              {rowEditable ? (
                <select
                  disabled={busy}
                  value={row.userType}
                  onChange={(e) => handleRoleChange(row, e.target.value)}
                  className="input-field w-full py-2 text-sm"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  {canAssignOwner ? <option value="owner">owner</option> : null}
                </select>
              ) : (
                <span className={`inline-flex text-xs px-2 py-1 rounded-xl ${row.userType === "owner" ? "bg-glacier text-brand-dark" : row.userType === "admin" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                  {row.userType}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Registered</p>
              <span className={`inline-flex text-xs px-2 py-1 rounded-xl ${row.registeredOrNot ? "bg-glacier text-brand-dark" : "bg-slate-100 text-slate-700"}`}>
                {row.registeredOrNot ? "Registered" : "Not Registered"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">API Log Viewer Allowed</p>
              {rowEditable ? (
                <select
                  disabled={busy}
                  value={row.apiLogViewerAllowed ? "yes" : "no"}
                  onChange={(e) => handleApiLogViewerAllowedChange(row, e.target.value === "yes")}
                  className="input-field w-full py-2 text-sm"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <span className={`inline-flex text-xs px-2 py-1 rounded-xl ${row.apiLogViewerAllowed ? "bg-sage-soft text-sage" : "bg-slate-100 text-slate-700"}`}>
                  {row.apiLogViewerAllowed ? "Yes" : "No"}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Can Create Elections</p>
              {rowEditable ? (
                <select
                  disabled={busy}
                  value={row.canCreateElections ? "yes" : "no"}
                  onChange={(e) => handleCanCreateElectionsChange(row, e.target.value === "yes")}
                  className="input-field w-full py-2 text-sm"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <span className={`inline-flex text-xs px-2 py-1 rounded-xl ${row.canCreateElections ? "bg-sage-soft text-sage" : "bg-slate-100 text-slate-700"}`}>
                  {row.canCreateElections ? "Yes" : "No"}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Last Active</p>
            <p className="text-sm text-slate-700">{row.lastActive ? timezoneUtils.formatDateTime(row.lastActive) : "-"}</p>
          </div>
        </div>
      );
    }

    return (
      <tr key={row.authorizedUserId} className="hover:bg-glacier/50 transition-colors">
        {canManage ? (
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!rowEditable || busy}
              onChange={() => toggleUserSelection(row.authorizedUserId)}
              className="rounded border-gray-300"
            />
          </td>
        ) : null}
        <td className="px-4 py-3 text-sm font-medium text-ink">{row.email}</td>
        <td className="px-4 py-3">
          {rowEditable ? (
            <select
              disabled={busy}
              value={row.apiLogViewerAllowed ? "yes" : "no"}
              onChange={(e) => handleApiLogViewerAllowedChange(row, e.target.value === "yes")}
              className="input-field py-1.5 text-sm"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : (
            <span className={`text-xs px-2 py-1 rounded-xl ${row.apiLogViewerAllowed ? "bg-sage-soft text-sage" : "bg-slate-100 text-slate-700"}`}>
              {row.apiLogViewerAllowed ? "Yes" : "No"}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-1 rounded-xl ${row.registeredOrNot ? "bg-glacier text-brand-dark" : "bg-slate-100 text-slate-700"}`}>
            {row.registeredOrNot ? "Registered" : "Not Registered"}
          </span>
        </td>
        <td className="px-4 py-3">
          {rowEditable ? (
            <select
              disabled={busy}
              value={row.userType}
              onChange={(e) => handleRoleChange(row, e.target.value)}
              className="input-field py-1.5 text-sm"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
              {canAssignOwner ? <option value="owner">owner</option> : null}
            </select>
          ) : (
            <span className={`text-xs px-2 py-1 rounded-xl ${row.userType === "owner" ? "bg-glacier text-brand-dark" : row.userType === "admin" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
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
              className="input-field py-1.5 text-sm"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : (
            <span className={`text-xs px-2 py-1 rounded-xl ${row.canCreateElections ? "bg-sage-soft text-sage" : "bg-slate-100 text-slate-700"}`}>
              {row.canCreateElections ? "Yes" : "No"}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{row.lastActive ? timezoneUtils.formatDateTime(row.lastActive) : "-"}</td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-frost-mesh">
    <div className="page-enter max-w-[1800px] mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      {accessDenied || (!loading && !canManage && error) ? (
        <div className="glass-panel p-8 text-center max-w-lg mx-auto">
          <FiShield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="section-kicker text-rose-600">Restricted workspace</p>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">Access Restricted</h1>
          <p className="text-slate-600 text-sm">
            The Authenticated Users page is only available to app owners and administrators.
          </p>
        </div>
      ) : (
      <div className="surface-card overflow-hidden">
        <div className="relative overflow-hidden bg-deep p-6 text-white">
          <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-24 w-80 rounded-full bg-glacier/10 blur-3xl" />
          <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">Access control</p>
              <h1 className="font-display text-3xl font-bold flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand shadow-brand"><FiUsers className="h-5 w-5" /></span>
                Authenticated Users
              </h1>
              <p className="text-sm text-glacier mt-1">
                Manage authorized users, roles, and registration settings. Admin and owner only.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="btn-ghost inline-flex items-center justify-center gap-2 w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-frost">Current role: {currentUserType}</span>
            <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-frost">Management access: {canManage ? "Enabled" : "Read only"}</span>
          </div>
          </div>
        </div>

        {canManage ? (
          <div className="p-5 border-b border-slate-200 space-y-4 bg-frost/60">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs text-gray-600 mb-1">Add User Email</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  className="input-field w-full py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Role</label>
                  <select
                    value={newUserType}
                    onChange={(e) => setNewUserType(e.target.value)}
                    className="input-field py-2 text-sm"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    {canAssignOwner ? <option value="owner">owner</option> : null}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn-brand inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <FiUserPlus className="h-4 w-4" /> Add
                </button>
              </form>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Bulk Add via CSV</label>
                <label className="btn-ghost inline-flex cursor-pointer items-center justify-center gap-2 w-full sm:w-auto">
                  <FiUpload className="h-4 w-4" />
                  {uploadingCsv ? "Uploading..." : "Upload CSV"}
                  <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="glass-panel rounded-2xl border-brand/20 p-4">
              <p className="section-kicker">Policy controls</p>
              <h3 className="text-sm font-semibold text-ink mb-3">Permission Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink mb-1">Permission to Register</label>
                  <select
                    value={settings.registrationOpenToAll ? "all" : "authenticated"}
                    onChange={(e) => setSettings((prev) => ({
                      ...prev,
                      registrationOpenToAll: e.target.value === "all",
                    }))}
                    className="input-field w-full py-2 text-sm"
                  >
                    <option value="all">Allow all emails</option>
                    <option value="authenticated">Allow only authenticated users</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink mb-1">Permission to Create Elections</label>
                  <select
                    value={settings.electionCreationPermissionScope || "all_admins_owners"}
                    onChange={(e) => setSettings((prev) => ({
                      ...prev,
                      electionCreationPermissionScope: e.target.value,
                    }))}
                    className="input-field w-full py-2 text-sm"
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
                  className="btn-deep w-full sm:w-auto"
                >
                  Save Permission Settings
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="m-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
            <FiAlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="m-4 bg-sage-soft border border-sage/20 rounded-2xl px-4 py-3 text-sage text-sm flex items-center gap-2">
            <FiCheckCircle className="h-4 w-4" />
            <span>{success}</span>
          </div>
        ) : null}

        <div className="border-b border-slate-200 bg-white/60 px-5 pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition ${
                activeTab === "users"
                  ? "border-brand text-brand-dark bg-glacier"
                  : "border-transparent text-slate-500 hover:text-ink hover:bg-frost"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FiUsers className="h-4 w-4" /> Auth Users
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition ${
                activeTab === "logs"
                  ? "border-brand text-brand-dark bg-glacier"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FiShield className="h-4 w-4" /> Auth User Logs
              </span>
            </button>
          </div>
        </div>

        {activeTab === "users" ? (
          <div className="p-5 space-y-4">
            <form onSubmit={handleUserSearch} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by email..."
                  className="input-field w-full py-2.5 pl-10 pr-4 text-sm"
                />
              </div>
              <button
                type="submit"
                className="btn-brand inline-flex items-center justify-center gap-2 px-4 py-2.5"
              >
                <FiSearch className="h-4 w-4" /> Search
              </button>
            </form>

            <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter by role</span>
              {ROLE_OPTIONS.map(({ id, label }) => (
                <label key={id} className="inline-flex items-center gap-2 rounded-xl bg-frost px-3 py-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={roleFilters[id]}
                    onChange={() => toggleRoleFilter(id)}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>

            {canManage ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-frost/50 p-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAllUsers}
                    disabled={selectableUsers.length === 0 || deleting}
                    className="rounded border-gray-300"
                  />
                  Select all on this page
                </label>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedUserIds.size === 0 || deleting}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  <FiTrash2 className="h-4 w-4" />
                  {deleting ? "Deleting..." : `Delete selected (${selectedUserIds.size})`}
                </button>
              </div>
            ) : null}

            <div className="surface-card md:hidden divide-y divide-slate-100 overflow-hidden">
              {loading ? (
                <div className="px-4 py-8 text-sm text-gray-500 text-center">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                  {noRoleFiltersSelected ? "Select at least one role filter." : "No users match your search."}
                </div>
              ) : (
                users.map((row) => renderUserRow(row, true))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-frost">
                  <tr>
                    {canManage ? (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-10">
                        <input
                          type="checkbox"
                          checked={allSelectableSelected}
                          onChange={toggleSelectAllUsers}
                          disabled={selectableUsers.length === 0 || deleting}
                          className="rounded border-gray-300"
                        />
                      </th>
                    ) : null}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">API Log Viewer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Registered</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">User Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Can Create Elections</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Last Active</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-sm text-gray-500 text-center">Loading users...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-sm text-gray-500 text-center">
                        {noRoleFiltersSelected ? "Select at least one role filter." : "No users match your search."}
                      </td>
                    </tr>
                  ) : (
                    users.map((row) => renderUserRow(row, false))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-sm text-gray-600">
                Showing {usersRangeStart}–{usersRangeEnd} of {usersTotal}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
                  disabled={usersPage === 0 || loading}
                  className="btn-ghost inline-flex items-center gap-1 px-4 py-2 disabled:opacity-50"
                >
                  <FiChevronLeft className="h-4 w-4" /> Previous 50
                </button>
                <button
                  type="button"
                  onClick={() => setUsersPage((p) => p + 1)}
                  disabled={!usersHasNext || loading}
                  className="btn-brand inline-flex items-center gap-1 px-4 py-2 disabled:opacity-50"
                >
                  Next 50 <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {!canManage ? (
              <div className="glass-panel px-4 py-8 text-sm text-slate-500 text-center">
                Only admin and owner can view action history.
              </div>
            ) : (
              <>
                <form onSubmit={handleLogsSearch} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      value={logsSearchInput}
                      onChange={(e) => setLogsSearchInput(e.target.value)}
                      placeholder="Search logs by actor, target, action, or details..."
                      className="input-field w-full py-2.5 pl-10 pr-4 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-brand inline-flex items-center justify-center gap-2 px-4 py-2.5"
                  >
                    <FiSearch className="h-4 w-4" /> Search
                  </button>
                </form>

                <div className="surface-card md:hidden divide-y divide-slate-100 overflow-hidden">
                  {loading ? (
                    <div className="px-4 py-8 text-sm text-gray-500 text-center">Loading logs...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-gray-500 text-center">No actions logged yet.</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.auditLogId} className="p-4 space-y-2">
                        <div className="text-xs text-gray-500">{log.createdAt ? timezoneUtils.formatDateTime(log.createdAt) : "-"}</div>
                        <div className="text-sm font-semibold text-gray-900 break-words">{log.actionType}</div>
                        <div className="text-sm text-gray-700 break-all">Actor: {log.actorEmail || "-"}</div>
                        <div className="text-sm text-gray-700 break-all">Target: {log.targetEmail || "-"}</div>
                        <div className="text-sm text-gray-700">{log.details || "-"}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-frost">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Target</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-sm text-gray-500 text-center">Loading logs...</td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-sm text-gray-500 text-center">No actions logged yet.</td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.auditLogId} className="hover:bg-glacier/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-700">{log.createdAt ? timezoneUtils.formatDateTime(log.createdAt) : "-"}</td>
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

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                  <p className="text-sm text-gray-600">
                    Showing {logsRangeStart}–{logsRangeEnd} of {logsTotal}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                      disabled={logsPage === 0 || loading}
                      className="btn-ghost inline-flex items-center gap-1 px-4 py-2 disabled:opacity-50"
                    >
                      <FiChevronLeft className="h-4 w-4" /> Previous 50
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogsPage((p) => p + 1)}
                      disabled={!logsHasNext || loading}
                      className="btn-brand inline-flex items-center gap-1 px-4 py-2 disabled:opacity-50"
                    >
                      Next 50 <FiChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}
    </div>
    </div>
  );
};

export default AuthenticatedUsers;

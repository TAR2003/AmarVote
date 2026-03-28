import React, { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiRefreshCw, FiUsers } from "react-icons/fi";
import { getAuthorizedUsers, updateAuthorizedUser } from "../utils/api";

const AuthenticatedUsers = () => {
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [canManage, setCanManage] = useState(false);
  const [currentUserType, setCurrentUserType] = useState("user");
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAuthorizedUsers();
      setCanManage(!!data.canManage);
      setCurrentUserType(data.currentUserType || "user");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setDrafts({});
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load authenticated users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 4500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  const rows = useMemo(() => users.map((user) => {
    const draft = drafts[user.authorizedUserId] || {};
    return {
      ...user,
      email: draft.email ?? user.email,
      userType: draft.userType ?? user.userType,
      isAllowed: draft.isAllowed ?? user.isAllowed,
      registeredOrNot: draft.registeredOrNot ?? user.registeredOrNot,
    };
  }), [users, drafts]);

  const setRowDraft = (id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }));
  };

  const saveRow = async (row) => {
    if (!canManage || !row.canEdit) return;

    try {
      setSavingRowId(row.authorizedUserId);
      setError("");
      setSuccess("");

      await updateAuthorizedUser(row.authorizedUserId, {
        email: row.email,
        userType: row.userType,
        isAllowed: !!row.isAllowed,
        registeredOrNot: !!row.registeredOrNot,
      });

      setSuccess(`Updated ${row.email}`);
      await loadUsers();
    } catch (err) {
      setError(err.message || "Failed to update user.");
    } finally {
      setSavingRowId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 p-6 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FiUsers className="h-6 w-6" />
                Authenticated Users
              </h1>
              <p className="text-sm text-blue-100 mt-1">
                Visible to all logged-in users. Only admin and owner can edit.
              </p>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="mt-4 text-xs text-blue-100 space-x-4">
            <span>Current role: {currentUserType}</span>
            <span>Can manage: {canManage ? "Yes" : "No"}</span>
          </div>
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Allowed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">User Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-sm text-gray-500 text-center">Loading users...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-sm text-gray-500 text-center">No authenticated users found.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const rowEditable = canManage && row.canEdit;
                  const rowSaving = savingRowId === row.authorizedUserId;

                  return (
                    <tr key={row.authorizedUserId} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 align-top">
                        {rowEditable ? (
                          <input
                            type="email"
                            value={row.email || ""}
                            onChange={(e) => setRowDraft(row.authorizedUserId, { email: e.target.value })}
                            className="w-64 max-w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-800">{row.email}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        {rowEditable ? (
                          <select
                            value={row.isAllowed ? "yes" : "no"}
                            onChange={(e) => setRowDraft(row.authorizedUserId, { isAllowed: e.target.value === "yes" })}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${row.isAllowed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {row.isAllowed ? "Allowed" : "Blocked"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        {rowEditable ? (
                          <select
                            value={row.registeredOrNot ? "yes" : "no"}
                            onChange={(e) => setRowDraft(row.authorizedUserId, { registeredOrNot: e.target.value === "yes" })}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${row.registeredOrNot ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                            {row.registeredOrNot ? "Registered" : "Not Registered"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        {rowEditable ? (
                          <select
                            value={row.userType || "user"}
                            onChange={(e) => setRowDraft(row.authorizedUserId, { userType: e.target.value })}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            {currentUserType === "owner" ? <option value="owner">owner</option> : null}
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${row.userType === "owner" ? "bg-purple-100 text-purple-700" : row.userType === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                            {row.userType}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        {row.lastLogin ? new Date(row.lastLogin).toLocaleString() : "-"}
                      </td>

                      <td className="px-4 py-3 align-top">
                        {rowEditable ? (
                          <button
                            type="button"
                            disabled={rowSaving}
                            onClick={() => saveRow(row)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                          >
                            {rowSaving ? "Saving..." : "Save"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {canManage ? "Owner rows cannot be edited by admin." : "Read only"}
                          </span>
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
    </div>
  );
};

export default AuthenticatedUsers;

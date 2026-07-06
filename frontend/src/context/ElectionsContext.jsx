import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchAllElections, invalidateElectionsCache } from "../utils/api";

const ElectionsContext = createContext(null);

export function ElectionsProvider({ userEmail, children }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshElections = useCallback(async (forceRefresh = false) => {
    if (!userEmail) {
      setElections([]);
      setLoading(false);
      setError(null);
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      if (forceRefresh) {
        invalidateElectionsCache();
      }
      const data = await fetchAllElections({ forceRefresh });
      setElections(data);
      return data;
    } catch (err) {
      setError(err.message || "Failed to load elections");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    refreshElections().catch(() => {});
  }, [refreshElections]);

  return (
    <ElectionsContext.Provider
      value={{
        elections,
        setElections,
        loading,
        error,
        refreshElections,
      }}
    >
      {children}
    </ElectionsContext.Provider>
  );
}

export function useElections() {
  const context = useContext(ElectionsContext);
  if (!context) {
    throw new Error("useElections must be used within ElectionsProvider");
  }
  return context;
}

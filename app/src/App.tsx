import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { AppRecord, ImportLogEntry, RouteKey, ReviewState } from './types/app';
import type { ActionItem } from './types/features';
import { loadState, saveRecordsAndLog, loadActionStates, saveActionStates } from './lib/storage';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import IntelligenceInbox from './pages/IntelligenceInbox';
import RecordDetail from './pages/RecordDetail';
import ManagerBrief from './pages/ManagerBrief';
import RoutingReview from './pages/RoutingReview';
import ImportsReplay from './pages/ImportsReplay';
import Exports from './pages/Exports';
import DataStatus from './pages/DataStatus';
import RiskRadar from './pages/RiskRadar';
import ActionCenter from './pages/ActionCenter';
import ReplayInspector from './pages/ReplayInspector';
import DataQualityMonitor from './pages/DataQualityMonitor';
import { ToastProvider, useToast } from './components/Toast';
import CommandPalette from './components/CommandPalette';
import ConfirmDialog from './components/ConfirmDialog';

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const { showToast } = useToast();
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [importLog, setImportLog] = useState<ImportLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [persistedActions, setPersistedActions] = useState<Map<string, ActionItem>>(new Map());
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const state = loadState();
    setRecords(state.records);
    setImportLog(state.import_log);
    setPersistedActions(loadActionStates());
    setLoaded(true);
  }, []);

  // Command palette keyboard shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleStateChange = (newRecords: AppRecord[], newLog: ImportLogEntry[]) => {
    setRecords(newRecords);
    setImportLog(newLog);
    showToast(`Import complete: ${newRecords.length} records`, 'success');
  };

  const handleOverrideRoute = (sourceType: string, sourceId: string, route: RouteKey) => {
    setRecords(prev => {
      const next = prev.map(r =>
        r.source_type === sourceType && r.source_id === sourceId
          ? { ...r, effective_route: route, effective_routes: [route], manual_override: true, last_updated_at: new Date().toISOString() }
          : r
      );
      saveRecordsAndLog(next, importLog);
      return next;
    });
    showToast(`Route overridden for ${sourceType === 'call' ? records.find(r => r.source_id === sourceId)?.record_ref : records.find(r => r.source_id === sourceId)?.record_ref}`, 'success');
  };

  const handleClearOverride = (sourceType: string, sourceId: string) => {
    setRecords(prev => {
      const next = prev.map(r =>
        r.source_type === sourceType && r.source_id === sourceId
          ? {
              ...r,
              effective_route: r.suggested_route,
              effective_routes: r.suggested_routes,
              manual_override: false,
              last_updated_at: new Date().toISOString(),
            }
          : r
      );
      saveRecordsAndLog(next, importLog);
      return next;
    });
    showToast('Route override cleared', 'info');
  };

  const handleSetReviewState = (sourceType: string, sourceId: string, state: ReviewState) => {
    setRecords(prev => {
      const next = prev.map(r =>
        r.source_type === sourceType && r.source_id === sourceId
          ? {
              ...r,
              review_state: state,
              analysis: state === 'reviewed'
                ? { ...r.analysis, is_stale: false }
                : r.analysis,
              last_updated_at: new Date().toISOString(),
            }
          : r
      );
      saveRecordsAndLog(next, importLog);
      return next;
    });
    showToast(`Review state: ${state.replace(/_/g, ' ')}`, 'success');
  };

  const handleActionChange = useCallback((actionId: string, updates: Partial<ActionItem>) => {
    setPersistedActions(prev => {
      const existing = prev.get(actionId);
      const updated: ActionItem = existing
        ? { ...existing, ...updates, updatedAt: new Date().toISOString() }
        : { ...updates as ActionItem, id: actionId, updatedAt: new Date().toISOString() };
      const next = new Map(prev);
      next.set(actionId, updated);
      saveActionStates(next);
      return next;
    });
    showToast('Action updated', 'success');
  }, [showToast]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50 font-sans">
        <Sidebar onCommandPalette={() => setCommandPaletteOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard records={records} />} />

              <Route path="/inbox" element={<IntelligenceInbox records={records} />} />
              <Route
                path="/inbox/:sourceType/:sourceId"
                element={
                  <RecordDetail
                    records={records}
                    onOverrideRoute={handleOverrideRoute}
                    onClearOverride={handleClearOverride}
                    onSetReviewState={handleSetReviewState}
                  />
                }
              />

              <Route path="/brief" element={<ManagerBrief records={records} />} />

              <Route path="/risk" element={<RiskRadar records={records} />} />

              <Route
                path="/actions"
                element={
                  <ActionCenter
                    records={records}
                    persistedActions={persistedActions}
                    onActionChange={handleActionChange}
                  />
                }
              />

              <Route
                path="/routing"
                element={
                  <RoutingReview
                    records={records}
                    onOverrideRoute={handleOverrideRoute}
                    onClearOverride={handleClearOverride}
                    onSetReviewState={handleSetReviewState}
                  />
                }
              />

              <Route
                path="/imports"
                element={
                  <ImportsReplay
                    records={records}
                    importLog={importLog}
                    onStateChange={handleStateChange}
                  />
                }
              />

              <Route path="/replay" element={<ReplayInspector records={records} importLog={importLog} />} />

              <Route path="/exports" element={<Exports records={records} />} />

              <Route path="/quality" element={<DataQualityMonitor records={records} importLog={importLog} />} />

              <Route path="/status" element={<DataStatus records={records} />} />

              <Route
                path="*"
                element={
                  <div className="py-24 text-center text-gray-400">
                    <p className="text-lg font-medium">Page not found</p>
                  </div>
                }
              />
            </Routes>
          </div>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        records={records}
      />

      {/* Confirm Dialog placeholder (used by imports if needed) */}
      <ConfirmDialog
        open={confirmReset}
        title="Reset all data?"
        message="This will clear all imported records, manual overrides, and review states. This cannot be undone."
        confirmLabel="Reset"
        danger
        onConfirm={() => { setConfirmReset(false); }}
        onCancel={() => setConfirmReset(false)}
      />
    </BrowserRouter>
  );
}

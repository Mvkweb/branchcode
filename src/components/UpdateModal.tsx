import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Circle, ArrowDown, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useUpdate, type CommitUpdate, type ReleaseUpdate } from "../hooks/useUpdate";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function UpdateModal({ isOpen, onClose, currentVersion }: Props) {
  const { isLoading, error, data, selectedType, setType, checkUpdates, items } = useUpdate();
  const [installingKey, setInstallingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    checkUpdates();
  }, [isOpen, checkUpdates]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const lineClass = useMemo(() => {
    switch (selectedType) {
      case "commit":
        return "from-green-500/80 via-green-500/20";
      case "prerelease":
        return "from-yellow-500/80 via-yellow-500/20";
      case "stable":
        return "from-blue-500/80 via-blue-500/20";
    }
  }, [selectedType]);

  const dotClass = useMemo(() => {
    switch (selectedType) {
      case "commit":
        return "text-green-500";
      case "prerelease":
        return "text-yellow-500";
      case "stable":
        return "text-blue-500";
    }
  }, [selectedType]);

  async function onInstall(item: any, key: string) {
    try {
      setInstallingKey(key);
      
      // For releases, ask the backend for the best URL for this platform
      let url: string | null = null;
      if (item.assets && item.assets.length > 0) {
        url = await invoke<string | null>("get_release_url", { release: item });
      }
      
      if (!url) {
        console.error("No download URL available");
        return;
      }
      
      await invoke<string>("download_and_install", { url });
    } catch (e) {
      console.error(e);
    } finally {
      setInstallingKey(null);
    }
  }

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            aria-label="Close updates modal"
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-[640px] bg-[#0A0A0A] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-white/[0.03] blur-[80px]" />

            <div className="p-6 pb-2 relative">
              <button
                onClick={onClose}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-semibold text-white tracking-tight">Review Updates</h2>
                  <p className="text-[14px] text-gray-400 mt-1.5">
                    {currentVersion ? `Current version: ${currentVersion}` : "Check for the latest updates"}
                  </p>
                </div>

                <button
                  onClick={checkUpdates}
                  disabled={isLoading}
                  className="mt-1 inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-gray-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-lg disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              <div className="flex p-1 bg-white/[0.03] rounded-lg w-fit mt-6 border border-white/[0.05]">
                {(["commit", "prerelease", "stable"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`relative px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                      selectedType === t ? "text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {selectedType === t && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white/10 rounded-md shadow-sm"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 capitalize">
                      {t === "prerelease" ? "Pre-release" : t}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 h-[380px] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-medium text-white">
                  {selectedType === "commit" && "Commit Updates"}
                  {selectedType === "prerelease" && "Pre-release Updates"}
                  {selectedType === "stable" && "Stable Releases"}
                </h3>
                <span className="text-[13px] text-gray-500 font-medium">{items.length}</span>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                  {error}
                </div>
              )}

              {!isLoading && !data && (
                <div className="text-[13px] text-gray-400">
                  No update data (dev mode returns none).
                </div>
              )}

              <div className="relative pl-[18px]">
                <motion.div
                  layout
                  className={`absolute left-0 top-2 bottom-2 w-[2px] bg-gradient-to-b ${lineClass} to-transparent rounded-full`}
                />

                <div className="space-y-[18px]">
                  <motion.div
                    key={selectedType}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-[18px]"
                  >
                    {items.map((item: CommitUpdate | ReleaseUpdate, idx: number) => {
                      const isCommit = selectedType === "commit";
                      const key = isCommit ? (item as CommitUpdate).fullSha : (item as ReleaseUpdate).version;
                      const idOrVersion = isCommit ? (item as CommitUpdate).id : (item as ReleaseUpdate).version;

                      return (
                        <div key={key ?? idx} className="flex items-start justify-between group">
                          <div className="flex items-start space-x-3.5 pr-4">
                            <Circle className={`w-[15px] h-[15px] ${dotClass} mt-[3px] shrink-0 stroke-[2.5]`} />
                            <div>
                              <span className="text-[14px] text-gray-300 leading-snug">
                                <code className="font-mono text-[13px] text-gray-400">{idOrVersion}</code>
                                {" - "}
                                {"message" in item ? item.message : ""}
                              </span>

                              <div className="text-[12px] text-gray-500 mt-1">
                                {isCommit && (item as CommitUpdate).branch && (
                                  <span className="text-blue-400">{(item as CommitUpdate).branch}</span>
                                )}
                                {isCommit && (item as CommitUpdate).branch ? " - " : ""}
                                {formatDate(item.date)}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => onInstall(item, String(key ?? idx))}
                            disabled={installingKey === String(key ?? idx)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-[12px] font-medium text-white bg-green-600 hover:bg-green-500 rounded-md transition-colors shrink-0 disabled:opacity-50 disabled:hover:bg-green-600"
                          >
                            <ArrowDown className="w-3 h-3" />
                            <span>{installingKey === String(key ?? idx) ? "Installing..." : "Install"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-5 bg-[#0A0A0A]">
              <div className="flex items-center justify-end space-x-3 border-t border-white/[0.06] pt-5">
                <button
                  onClick={onClose}
                  className="flex items-center space-x-2 px-4 py-2 text-[14px] font-medium text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-[18px] h-[18px]" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
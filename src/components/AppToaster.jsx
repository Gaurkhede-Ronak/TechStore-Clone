import { useEffect } from "react";
import toast, { Toaster, useToasterStore } from "react-hot-toast";

const MAX_VISIBLE_TOASTS = 2;

const activeIds = new Set();
const pendingQueue = [];
let toastCounter = 0;
let isPatched = false;

const rawSuccess = toast.success.bind(toast);
const rawError = toast.error.bind(toast);
const rawLoading = toast.loading.bind(toast);
const rawCustom = toast.custom.bind(toast);
const rawDismiss = toast.dismiss.bind(toast);

function enqueueOrShow(rawFn, message, options = {}) {
  const id =
    options?.id || `techstore-toast-${++toastCounter}-${Date.now()}`;
  const nextOptions = { ...options, id };

  // 1. If already visible on screen (e.g., updating a loading toast in-place), update immediately
  if (activeIds.has(id)) {
    return rawFn(message, nextOptions);
  }

  // 2. If already waiting in the pending queue, update the queued item in-place
  const queuedIndex = pendingQueue.findIndex((item) => item.id === id);
  if (queuedIndex !== -1) {
    pendingQueue[queuedIndex] = {
      id,
      rawFn,
      message,
      options: nextOptions,
    };
    return id;
  }

  // 3. If fewer than 2 toasts are currently active, show immediately
  if (activeIds.size < MAX_VISIBLE_TOASTS) {
    activeIds.add(id);
    return rawFn(message, nextOptions);
  }

  // 4. Otherwise, hold in the pending queue until one of the 2 active toasts finishes
  pendingQueue.push({
    id,
    rawFn,
    message,
    options: nextOptions,
  });

  return id;
}

function patchToastSingleton() {
  if (isPatched) return;
  isPatched = true;

  toast.success = (message, options) =>
    enqueueOrShow(rawSuccess, message, options);

  toast.error = (message, options) =>
    enqueueOrShow(rawError, message, options);

  toast.loading = (message, options) =>
    enqueueOrShow(rawLoading, message, options);

  toast.custom = (message, options) =>
    enqueueOrShow(rawCustom, message, options);

  toast.dismiss = (toastId) => {
    if (toastId) {
      const idx = pendingQueue.findIndex((item) => item.id === toastId);
      if (idx !== -1) {
        pendingQueue.splice(idx, 1);
      }
      activeIds.delete(toastId);
    } else {
      pendingQueue.length = 0;
      activeIds.clear();
    }
    return rawDismiss(toastId);
  };
}

patchToastSingleton();

function AppToaster() {
  const { toasts } = useToasterStore();

  useEffect(() => {
    const visibleToasts = toasts.filter((t) => t.visible);
    const visibleIdSet = new Set(visibleToasts.map((t) => t.id));

    // Clean up any finished/dismissed toast IDs from activeIds
    for (const id of Array.from(activeIds)) {
      if (!visibleIdSet.has(id)) {
        activeIds.delete(id);
      }
    }

    // Remove non-visible toasts from DOM after exit animation so the stack stays clean
    const removeTimers = [];
    toasts.forEach((t) => {
      if (!t.visible) {
        const timer = setTimeout(() => {
          toast.remove(t.id);
        }, 200);
        removeTimers.push(timer);
      }
    });

    // Safety net: if a raw toast() call bypassed .success/.error, keep activeIds synced
    visibleToasts.forEach((t, index) => {
      if (index < MAX_VISIBLE_TOASTS) {
        activeIds.add(t.id);
      } else {
        rawDismiss(t.id);
      }
    });

    // As soon as a slot opens up (< 2 active), show the next pending toast from queue
    if (activeIds.size < MAX_VISIBLE_TOASTS && pendingQueue.length > 0) {
      const timer = setTimeout(() => {
        while (
          activeIds.size < MAX_VISIBLE_TOASTS &&
          pendingQueue.length > 0
        ) {
          const nextToast = pendingQueue.shift();
          if (nextToast) {
            activeIds.add(nextToast.id);
            nextToast.rawFn(nextToast.message, nextToast.options);
          }
        }
      }, 180);
      removeTimers.push(timer);
    }

    return () => {
      removeTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts]);

  return (
    <Toaster
      position="top-right"
      gutter={10}
      containerStyle={{
        top: 84,
        right: 20,
        zIndex: 999999,
      }}
      toastOptions={{
        duration: 2800,
        style: {
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: 600,
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
          maxWidth: "380px",
        },
      }}
    />
  );
}

export default AppToaster;

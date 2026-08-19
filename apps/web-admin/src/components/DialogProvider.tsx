import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
}

type DialogState =
  | { kind: "confirm"; options: ConfirmOptions }
  | { kind: "prompt"; options: PromptOptions; value: string }
  | null;

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const resolver = useRef<(value: boolean | string | null) => void>();

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve as (value: boolean | string | null) => void;
      setState({ kind: "confirm", options });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve as (value: boolean | string | null) => void;
      setState({ kind: "prompt", options, value: options.initialValue ?? "" });
    });
  }, []);

  function settle(value: boolean | string | null) {
    resolver.current?.(value);
    resolver.current = undefined;
    setState(null);
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => settle(state.kind === "confirm" ? false : null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6"
          >
            <h2 className="text-base font-bold text-slate-800 mb-2">{state.options.title}</h2>

            {state.kind === "confirm" ? (
              <p className="text-sm text-slate-500 mb-5">{state.options.message}</p>
            ) : (
              <>
                {state.options.message && <p className="text-sm text-slate-500 mb-3">{state.options.message}</p>}
                <input
                  autoFocus
                  value={state.value}
                  placeholder={state.options.placeholder}
                  onChange={(e) => setState({ ...state, value: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && settle(state.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => settle(state.kind === "confirm" ? false : null)}
                className="text-sm font-semibold text-slate-500 px-4 py-2"
              >
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => settle(state.kind === "confirm" ? true : state.value)}
                className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors ${
                  state.kind === "confirm" && state.options.danger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-brand-600 hover:bg-brand-700"
                }`}
              >
                {state.options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

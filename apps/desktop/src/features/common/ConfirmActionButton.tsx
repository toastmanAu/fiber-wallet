import type { ReactNode } from "react";

export type ConfirmationItem = {
  label: string;
  value: ReactNode;
};

type ConfirmActionButtonProps = {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  title: string;
  items: ConfirmationItem[];
  warning: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmActionButton({
  disabled = false,
  icon,
  label,
  title,
  items,
  warning,
  confirmLabel,
  onConfirm,
}: ConfirmActionButtonProps) {
  const dialogId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-confirmation`;

  return (
    <div className="confirm-action">
      <button className="command-button" disabled={disabled} type="button" onClick={() => showDialog(dialogId)}>
        {icon}
        <span>{label}</span>
      </button>
      <dialog className="confirm-dialog" id={dialogId}>
        <form method="dialog">
          <h2>{title}</h2>
          <dl>
            {items.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value || "not set"}</dd>
              </div>
            ))}
          </dl>
          <p>{warning}</p>
          <div className="node-actions">
            <button className="command-button ghost" type="submit">
              Cancel
            </button>
            <button
              className="command-button danger"
              type="submit"
              onClick={() => {
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function showDialog(dialogId: string) {
  const dialog = document.getElementById(dialogId) as HTMLDialogElement | null;
  if (!dialog) {
    return;
  }

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "");
}

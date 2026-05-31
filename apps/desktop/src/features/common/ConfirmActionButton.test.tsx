import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmActionButton } from "./ConfirmActionButton";

describe("ConfirmActionButton", () => {
  it("opens confirmation details before running the action", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionButton
        confirmLabel="Send"
        icon={<span aria-hidden="true">icon</span>}
        items={[{ label: "Amount", value: "1000" }]}
        label="Send Payment"
        onConfirm={onConfirm}
        title="Confirm Payment"
        warning="This will broadcast through the active RPC profile."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /send payment/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

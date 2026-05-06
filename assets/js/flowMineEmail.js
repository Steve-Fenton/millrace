import { showFlowAlert, showFlowPrompt } from "./ui/showMessage.js";
import { patchLocalUserMine } from "./client.js";

/**
 * Prompt for `[user] mine` and persist. Returns null if cancelled or invalid.
 * @param {string} [defaultHint] prefilled in the input (e.g. last card owner email)
 * @returns {Promise<string | null>} trimmed email or null
 */
export async function ensureMineEmailConfigured(defaultHint = "") {
  const entered = await showFlowPrompt(
    "Enter the email you use as card owner so Mine can match your cards.",
    {
      title: "Mine filter",
      placeholder: "you@company.com",
      defaultValue: String(defaultHint ?? "").trim(),
      confirmLabel: "Save",
    }
  );
  if (entered == null) return null;
  const v = String(entered).trim();
  if (!v.includes("@")) {
    await showFlowAlert("Please enter a valid email address.", {
      title: "Mine filter",
    });
    return null;
  }
  await patchLocalUserMine(v);
  return v;
}

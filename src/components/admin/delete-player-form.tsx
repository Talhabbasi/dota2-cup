"use client";

import { useRouter } from "next/navigation";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { actionDeletePlayer } from "@/app/admin/actions";

export function DeletePlayerForm({
  discordId,
  seasonId,
  playerName,
  teamName,
}: {
  discordId: string;
  seasonId: string;
  playerName: string;
  teamName?: string | null;
}) {
  const router = useRouter();
  const listHref = `/admin/players?season=${encodeURIComponent(seasonId)}`;

  return (
    <AdminConfirmForm
      action={actionDeletePlayer}
      title="Delete player"
      confirmLabel="Delete permanently"
      successMessage="Player deleted"
      refresh="none"
      message={`Delete ${playerName} permanently? This removes their registration${
        teamName ? ` and takes them off ${teamName}` : ""
      }. This cannot be undone.`}
      onResult={() => {
        router.push(listHref);
        router.refresh();
      }}
    >
      <input type="hidden" name="discordId" value={discordId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <AdminSubmitButton
        variant="danger"
        className="w-full sm:w-auto"
        pendingLabel="Deleting…"
      >
        Delete player
      </AdminSubmitButton>
    </AdminConfirmForm>
  );
}

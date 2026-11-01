import "dotenv/config";
import {
  applyStandInCorrections,
  planStandInCorrections,
} from "../src/lib/stand-in-correct";

async function main() {
const apply = process.argv.includes("--apply");
const plan = await planStandInCorrections();

console.log(
  JSON.stringify(
    {
      apply,
      changes: plan.changes.length,
      review: plan.review.length,
      sampleChanges: plan.changes.slice(0, 30),
      sampleReview: plan.review.slice(0, 30),
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log("Dry run only. Re-run with --apply to update asStandIn flags.");
  process.exit(0);
}

const updated = await applyStandInCorrections(plan.changes);
const again = await planStandInCorrections();
console.log(
  JSON.stringify(
    {
      updated,
      remainingChanges: again.changes.length,
      review: again.review.length,
    },
    null,
    2,
  ),
);
if (again.changes.length !== 0) {
  throw new Error("Stand-in correction was not idempotent.");
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

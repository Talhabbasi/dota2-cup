import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_PAGE_TAG } from "./cache-tags";

export { PUBLIC_PAGE_TAG };

export function revalidatePublicPages() {
  revalidateTag(PUBLIC_PAGE_TAG, "max");
  revalidatePath("/", "layout");
}

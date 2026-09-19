import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_PAGE_TAG = "public-pages";

export function revalidatePublicPages() {
  revalidateTag(PUBLIC_PAGE_TAG, "max");
  revalidatePath("/", "layout");
}

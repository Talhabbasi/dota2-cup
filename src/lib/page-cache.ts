import { revalidatePath } from "next/cache";

export function revalidatePublicPages() {
  revalidatePath("/", "layout");
}

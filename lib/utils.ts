import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatName(fullName: string | null | undefined): string {
    if (!fullName) return "Nieznany";
    const parts = fullName.trim().split(" ");
    if (parts.length >= 2) {
        // Assume last word is the last name, unless there are multiple, but standard "Firstname Lastname" applies
        const lastName = parts.pop();
        return `${lastName} ${parts.join(" ")}`;
    }
    return fullName;
}

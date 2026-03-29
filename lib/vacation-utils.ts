import { getBusinessDaysCount } from "./holidays";

/**
 * Groups consecutive vacation records of same type and status.
 * Considers Friday and Monday consecutive if no business days between them.
 * Works with any objects that have id, userId, startDate, endDate, type, status, and optionally note.
 */
export function groupVacations(vacations: any[]): any[] {
    if (vacations.length <= 1) return vacations;

    // Sort by start date to process in chronologic order
    const sorted = [...vacations].sort((a, b) => 
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const groups: any[] = [];

    for (const v of sorted) {
        if (groups.length === 0) {
            groups.push({ ...v, mergedIds: [v.id] });
            continue;
        }

        const lastGroup = groups[groups.length - 1];
        const lastEnd = new Date(lastGroup.endDate);
        const currentStart = new Date(v.startDate);

        // Logic check: Any business days between last end and current start?
        const gapStart = new Date(lastEnd);
        gapStart.setDate(gapStart.getDate() + 1);
        
        const gapEnd = new Date(currentStart);
        gapEnd.setDate(gapEnd.getDate() - 1);

        const businessDaysInGap = getBusinessDaysCount(gapStart, gapEnd);

        const isConsecutive = businessDaysInGap === 0;

        if (
            v.type === lastGroup.type && 
            v.status === lastGroup.status && 
            v.userId === lastGroup.userId &&
            isConsecutive
        ) {
            // Merge into current group
            lastGroup.endDate = v.endDate;
            if (!lastGroup.mergedIds) lastGroup.mergedIds = [lastGroup.id];
            lastGroup.mergedIds.push(v.id);
            
            // Merge notes
            if (v.note && v.note !== lastGroup.note) {
                lastGroup.note = lastGroup.note 
                    ? `${lastGroup.note}; ${v.note}` 
                    : v.note;
            }
        } else {
            groups.push({ ...v, mergedIds: [v.id] });
        }
    }

    // Return sorted descending (most recent first) for display
    return groups.sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
}

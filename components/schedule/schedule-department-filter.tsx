"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Department } from "@prisma/client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

interface ScheduleDepartmentFilterProps {
    departments: Department[];
    currentDeptId?: string;
}

export function ScheduleDepartmentFilter({ departments, currentDeptId }: ScheduleDepartmentFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleDepartmentChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === "ALL") {
            params.delete("dept");
        } else {
            params.set("dept", value);
        }

        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={currentDeptId || "ALL"} onValueChange={handleDepartmentChange}>
                <SelectTrigger className="w-[200px] h-9 bg-background">
                    <SelectValue placeholder="Wszystkie działy" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Wszystkie działy</SelectItem>
                    {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

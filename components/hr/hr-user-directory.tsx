"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { User as PrismaUser, MedicalExam, Department } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { User, Shield, AlertTriangle, Search, Filter } from "lucide-react";
import { formatName } from "@/lib/utils";

type UserWithRelations = PrismaUser & {
    medicalExams: MedicalExam[];
    department: Department | null;
};

interface HRUserDirectoryProps {
    initialUsers: UserWithRelations[];
    departments: Department[];
    currentUserRole?: string;
    currentUserDeptId?: number | null;
    isManagerInHR?: boolean;
}

export function HRUserDirectory({ initialUsers, departments, currentUserRole, currentUserDeptId, isManagerInHR }: HRUserDirectoryProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
    const [sortBy, setSortBy] = useState<string>("name-asc");

    const now = new Date();

    // Filter and sort users
    const filteredUsers = useMemo(() => {
        let result = [...initialUsers];

        // Search filter
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase();
            result = result.filter(user =>
                formatName(user.name || user.username).toLowerCase().includes(query) ||
                user.username.toLowerCase().includes(query)
            );
        }

        // Department filter
        if (selectedDepartment !== "ALL") {
            result = result.filter(user =>
                user.departmentId?.toString() === selectedDepartment ||
                (user as any).secondaryDepartmentId?.toString() === selectedDepartment
            );
        }

        // Sorting
        result.sort((a, b) => {
            const nameA = formatName(a.name || a.username).toLowerCase();
            const nameB = formatName(b.name || b.username).toLowerCase();

            switch (sortBy) {
                case "name-asc":
                    return nameA.localeCompare(nameB);
                case "name-desc":
                    return nameB.localeCompare(nameA);
                case "newest":
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case "oldest":
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                default:
                    return 0;
            }
        });

        return result;
    }, [initialUsers, searchQuery, selectedDepartment, sortBy]);


    return (
        <div className="space-y-6">
            <Card className="bg-muted/30">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
                    <div className="w-full md:flex-1 space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            Szukaj Pracownika
                        </label>
                        <Input
                            placeholder="Wpisz imię i nazwisko..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-background"
                        />
                    </div>

                    {(currentUserRole !== 'MANAGER' || isManagerInHR) && (
                        <div className="w-full md:w-[200px] space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                Dział Firmy
                            </label>
                            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                <SelectTrigger className="bg-background">
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
                    )}

                    <div className="w-full md:w-[200px] space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Sortuj wg
                        </label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Alfabetycznie A-Z" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name-asc">Alfabetycznie (A-Z)</SelectItem>
                                <SelectItem value="name-desc">Alfabetycznie (Z-A)</SelectItem>
                                <SelectItem value="newest">Najnowsi</SelectItem>
                                <SelectItem value="oldest">Najstarsi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground">
                Znaleziono: <span className="font-semibold text-foreground">{filteredUsers.length}</span> {filteredUsers.length === 1 ? 'pracownika' : 'pracowników'}
            </div>

            {filteredUsers.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                        <Search className="h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold mb-2">Brak wyników wyszukiwania</h3>
                        <p>Nie odnaleziono pracowników spełniających zadane kryteria filtrów.</p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => {
                                setSearchQuery("");
                                if (currentUserRole !== 'MANAGER' || isManagerInHR) {
                                    setSelectedDepartment("ALL");
                                }
                                setSortBy("name-asc");
                            }}
                        >
                            Wyczyść filtry
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    {filteredUsers.map(user => {
                        const expiringCount = user.medicalExams.filter((exam: any) => {
                            const daysLeft = Math.ceil((new Date(exam.validUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            return daysLeft <= 30;
                        }).length;

                        return (
                            <Card key={user.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 gap-4 hover:shadow-md transition-shadow ${expiringCount > 0 ? 'border-red-300 bg-red-50/30 dark:border-red-900/50 dark:bg-red-900/10' : ''}`}>
                                <div className="flex items-center gap-4 min-w-0 flex-1 w-full">
                                    <Avatar className="h-12 w-12 border shadow-sm shrink-0">
                                        <AvatarImage src={user.image || ""} className="object-cover h-full w-full" />
                                        <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 font-bold flex items-center justify-center h-full w-full">
                                            {formatName(user.name || user.username).substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-semibold text-foreground truncate">
                                                {formatName(user.name || user.username)}
                                            </h3>
                                            {user.role === 'ADMIN' ? <Shield className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" /> : <User className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                                            <span className="font-medium">{user.role}</span>
                                            {user.department && (
                                                <>
                                                    <span className="opacity-50 hidden sm:inline">•</span>
                                                    <span className="uppercase tracking-wider text-xs truncate bg-muted/50 px-2 py-0.5 rounded-full">{user.department.name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 sm:pl-0">
                                    {expiringCount > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40 px-3 py-1.5 rounded-full animate-pulse">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <span className="whitespace-nowrap">{expiringCount} do odnowienia</span>
                                        </div>
                                    )}
                                    <Button
                                        asChild
                                        className={`shrink-0 ${expiringCount > 0 ? 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800' : ''}`}
                                        variant={expiringCount > 0 ? 'default' : 'outline'}
                                        size="sm"
                                    >
                                        <Link href={`/dashboard/profile?userId=${user.id}`}>
                                            {expiringCount > 0 ? 'Sprawdź Badania' : 'Zobacz Profil'}
                                        </Link>
                                    </Button>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    );
}

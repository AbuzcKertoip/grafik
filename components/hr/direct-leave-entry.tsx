"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createVacation } from "@/lib/actions/vacations";
import { useRouter } from "next/navigation";

interface DirectLeaveEntryProps {
    userId: number;
}

export function DirectLeaveEntry({ userId }: DirectLeaveEntryProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: "VACATION",
        startDate: "",
        endDate: "",
        applicationDate: new Date().toISOString().split('T')[0],
        note: ""
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.startDate || !formData.endDate) {
            toast.error("Wybierz datę początkową i końcową");
            return;
        }

        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);

        if (start > end) {
            toast.error("Data początkowa nie może być późniejsza niż końcowa");
            return;
        }

        setIsLoading(true);
        try {
            // Action automatically handles approval if caller is HR/Admin or SICK leave for Manager
            const res = await createVacation({
                userId,
                startDate: formData.startDate,
                endDate: formData.endDate,
                type: formData.type,
                note: formData.note,
                applicationDate: formData.applicationDate
            });

            if (res.success) {
                toast.success("Zatwierdzona nieobecność została dodana.");
                setIsOpen(false);
                setFormData({ type: "VACATION", startDate: "", endDate: "", applicationDate: new Date().toISOString().split('T')[0], note: "" });
                router.refresh();
            } else {
                toast.error(res.error || "Wystąpił błąd");
            }
        } catch (error) {
            toast.error("Wystąpił błąd serwera");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm" className="h-8">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Wprowadź Nieobecność
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Wprowadź Zatwierdzoną Nieobecność</DialogTitle>
                    <DialogDescription>
                        Jako HR lub Manager możesz dodać nieobecność (np. L4, Urlop) bezpośrednio do grafiku pracownika. Wniosek zostanie automatycznie zatwierdzony.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSave} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="type">Typ nieobecności</Label>
                        <Select 
                            value={formData.type} 
                            onValueChange={(val) => setFormData({ ...formData, type: val })}
                        >
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Wybierz typ urlopu" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VACATION">Urlop wypoczynkowy</SelectItem>
                                <SelectItem value="SICK">L4 / Chorobowe</SelectItem>
                                <SelectItem value="CHILDCARE">Opieka nad dzieckiem</SelectItem>
                                <SelectItem value="SPECIAL_LEAVE">Urlop okolicznościowy</SelectItem>
                                <SelectItem value="ON_DEMAND">Urlop na żądanie</SelectItem>
                                <SelectItem value="ADDITIONAL">Urlop dodatkowy (lojalnościowy)</SelectItem>
                                <SelectItem value="OVERTIME">Odbiór nadgodzin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="startDate">Od</Label>
                            <Input
                                id="startDate"
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="endDate">Do</Label>
                            <Input
                                id="endDate"
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="applicationDate">Data wygenerowania druku <span className="text-xs text-muted-foreground font-normal">(widoczna we wniosku docx)</span></Label>
                        <Input
                            id="applicationDate"
                            type="date"
                            value={formData.applicationDate}
                            onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="note">Notatka / Adnotacja (opcjonalnie)</Label>
                        <Input
                            id="note"
                            placeholder="Np. 'Lojalnościowy', 'Zatwierdzone ustnie'..."
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        />
                    </div>

                    <DialogFooter className="mt-4">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Dodawanie..." : "Dodaj do grafiku"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

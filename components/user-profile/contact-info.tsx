"use client";

import { useState } from "react";
import { User } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Phone, Mail, AlertCircle, Edit2, Save, X } from "lucide-react";
import { updateContactInfo } from "@/lib/actions/users";

interface ContactInfoProps {
    user: Partial<User>;
    isAdminOrOwner: boolean;
}

export function ContactInfo({ user, isAdminOrOwner }: ContactInfoProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        phone: user.phone || "",
        email: user.email || "",
        emergencyContact: user.emergencyContact || ""
    });

    const handleSave = async () => {
        if (!user.id) return;
        setIsSaving(true);
        try {
            const formDataObj = new FormData();
            formDataObj.append("userId", user.id.toString());
            formDataObj.append("phone", formData.phone);
            formDataObj.append("email", formData.email);
            formDataObj.append("emergencyContact", formData.emergencyContact);

            const result = await updateContactInfo(formDataObj);

            if (result.success) {
                toast.success("Zaktualizowano dane kontaktowe");
                setIsEditing(false);
            } else {
                toast.error(result.error || "Wystąpił błąd");
            }
        } catch (error) {
            toast.error("Błąd podczas zapisywania dancyh");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Dane Kontaktowe</CardTitle>
                {isAdminOrOwner && !isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edytuj
                    </Button>
                )}
                {isAdminOrOwner && isEditing && (
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                            <X className="w-4 h-4 mr-2" />
                            Anuluj
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            <Save className="w-4 h-4 mr-2" />
                            Zapisz
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-muted p-3 rounded-full">
                            <Phone className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label>Numer telefonu</Label>
                            {isEditing ? (
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="+48 123 456 789"
                                />
                            ) : (
                                <p className="text-foreground font-medium">
                                    {user.phone || <span className="text-muted-foreground italic">Brak danych</span>}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-muted p-3 rounded-full">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label>Adres e-mail</Label>
                            {isEditing ? (
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="jan.kowalski@firma.pl"
                                />
                            ) : (
                                <p className="text-foreground font-medium">
                                    {user.email || <span className="text-muted-foreground italic">Brak danych</span>}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label className="text-red-600 dark:text-red-400">Kontakt alarmowy (w razie wypadku)</Label>
                            {isEditing ? (
                                <Input
                                    value={formData.emergencyContact}
                                    onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                                    placeholder="Anna Kowalska - 987 654 321"
                                />
                            ) : (
                                <p className="text-foreground font-medium">
                                    {user.emergencyContact || <span className="text-muted-foreground italic">Brak danych</span>}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

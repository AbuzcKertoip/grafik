"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { uploadCarPolicyScan, deleteCarPolicyScan } from "@/lib/actions/upload"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { FileText, Upload, Trash2, Eye, Loader2 } from "lucide-react"

interface CarPolicyDialogProps {
    carId: number
    carName: string
    policyUrl: string | null
    acPolicyUrl: string | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

interface PolicySectionProps {
    label: string
    type: "oc" | "ac"
    currentUrl: string | null
    carId: number
    onUploaded: (type: "oc" | "ac", url: string | null) => void
}

function PolicySection({ label, type, currentUrl, carId, onUploaded }: PolicySectionProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.type !== "application/pdf") {
            toast.error("Dozwolone są tylko pliki PDF")
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Plik nie może przekraczać 10 MB")
            return
        }

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const result = await uploadCarPolicyScan(carId, type, formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`Skan polisy ${label} wgrany pomyślnie`)
                onUploaded(type, result.fileUrl || null)
                router.refresh()
            }
        } finally {
            setIsUploading(false)
            // Reset input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleDelete = async () => {
        if (!confirm(`Czy na pewno chcesz usunąć skan polisy ${label}?`)) return
        setIsDeleting(true)
        try {
            const result = await deleteCarPolicyScan(carId, type)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`Skan polisy ${label} usunięty`)
                onUploaded(type, null)
                router.refresh()
            }
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-sm">Polisa {label}</h3>
            </div>

            {currentUrl ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="truncate">Skan dostępny</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => window.open(currentUrl, "_blank")}
                        >
                            <Eye className="h-4 w-4 mr-1" />
                            Podgląd PDF
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                    <div className="border-t pt-2">
                        <p className="text-xs text-muted-foreground mb-1">Zastąp plik:</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Wgrywanie...</>
                            ) : (
                                <><Upload className="h-4 w-4 mr-1" /> Wgraj nowy PDF</>
                            )}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Brak skanu polisy</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Wgrywanie...</>
                        ) : (
                            <><Upload className="h-4 w-4 mr-1" /> Wgraj skan polisy (PDF)</>
                        )}
                    </Button>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    )
}

export function CarPolicyDialog({
    carId,
    carName,
    policyUrl: initialPolicyUrl,
    acPolicyUrl: initialAcPolicyUrl,
    isOpen,
    onOpenChange,
}: CarPolicyDialogProps) {
    const [policyUrl, setPolicyUrl] = useState(initialPolicyUrl)
    const [acPolicyUrl, setAcPolicyUrl] = useState(initialAcPolicyUrl)

    const handleUploaded = (type: "oc" | "ac", url: string | null) => {
        if (type === "oc") setPolicyUrl(url)
        else setAcPolicyUrl(url)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        Skany Polis — {carName}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <PolicySection
                        label="OC"
                        type="oc"
                        currentUrl={policyUrl}
                        carId={carId}
                        onUploaded={handleUploaded}
                    />
                    <PolicySection
                        label="AC"
                        type="ac"
                        currentUrl={acPolicyUrl}
                        carId={carId}
                        onUploaded={handleUploaded}
                    />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                    Obsługiwane: PDF • Maks. rozmiar: 10 MB
                </p>
            </DialogContent>
        </Dialog>
    )
}

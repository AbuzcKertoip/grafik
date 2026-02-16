"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Loader2, Camera, X, Check } from "lucide-react"
import { uploadAvatar } from "@/lib/actions/upload"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Cropper from "react-easy-crop"
import getCroppedImg from "@/lib/canvasUtils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"

interface AvatarUploadProps {
    userId: number
    currentImage: string | null
    username: string
    editable: boolean
}

export function AvatarUpload({ userId, currentImage, username, editable }: AvatarUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Crop state
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast.error("Plik jest za duży (max 5MB)")
            return
        }

        const reader = new FileReader()
        reader.addEventListener("load", () => {
            setImageSrc(reader.result?.toString() || null)
            setIsCropDialogOpen(true)
        })
        reader.readAsDataURL(file)

        // Reset input value so same file can be selected again if needed
        e.target.value = ""
    }

    const handleSaveCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return

        setIsUploading(true)
        try {
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
            if (!croppedImageBlob) throw new Error("Could not crop image")

            const file = new File([croppedImageBlob], "avatar.jpg", { type: "image/jpeg" })
            const formData = new FormData()
            formData.append("file", file)

            const result = await uploadAvatar(userId, formData)
            if (result.success) {
                toast.success("Zdjęcie profilowe zaktualizowane")
                setIsCropDialogOpen(false)
                setImageSrc(null)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (e) {
            console.error(e)
            toast.error("Wystąpił błąd podczas przetwarzania zdjęcia")
        } finally {
            setIsUploading(false)
        }
    }

    const handleCancelCrop = () => {
        setImageSrc(null)
        setIsCropDialogOpen(false)
    }

    return (
        <>
            <div className="relative group shrink-0" style={{ width: '128px', height: '128px' }}>
                <div className="h-full w-full rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center">
                    <Avatar className="h-full w-full">
                        <AvatarImage src={currentImage || ""} className="object-cover h-full w-full" />
                        <AvatarFallback className="text-4xl bg-indigo-100 text-indigo-700 font-bold h-full w-full flex items-center justify-center">
                            {username?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {editable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}>
                        <Camera className="h-8 w-8 text-white" />
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileSelect}
                />
            </div>

            <Dialog open={isCropDialogOpen} onOpenChange={(open) => !open && handleCancelCrop()}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Dostosuj zdjęcie</DialogTitle>
                    </DialogHeader>

                    <div className="relative w-full rounded-md overflow-hidden bg-black" style={{ height: '300px', position: 'relative' }}>
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        )}
                    </div>

                    <div className="py-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                            <span>Przybliżenie</span>
                            <span>{(zoom * 100).toFixed(0)}%</span>
                        </div>
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(val: number[]) => setZoom(val[0])}
                        />
                    </div>

                    <DialogFooter className="sm:justify-between">
                        <Button variant="outline" onClick={handleCancelCrop} disabled={isUploading}>
                            <X className="h-4 w-4 mr-2" />
                            Anuluj
                        </Button>
                        <Button onClick={handleSaveCrop} disabled={isUploading}>
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Zapisz
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

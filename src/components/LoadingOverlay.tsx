import { Card, CardContent } from '@/components/ui/card'

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
}

const LoadingOverlay = ({ isVisible, message = "Initializing ultrasound communication..." }: LoadingOverlayProps) => {
  if (!isVisible) return null

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/80 flex items-center justify-center z-[1000]">
      <Card className="p-8 text-center">
        <CardContent className="flex flex-col gap-4 items-center">
          <div className="spinner w-8 h-8"></div>
          <p className="m-0 text-base">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoadingOverlay

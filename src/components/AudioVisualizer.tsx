import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AudioVisualizerProps {
  micVizRef: React.RefObject<HTMLCanvasElement>
  audioLevel: number
  detectedFreq: string
  fps?: string
}

const AudioVisualizer = ({ micVizRef, audioLevel, detectedFreq, fps }: AudioVisualizerProps) => {
  return (
    <Card className="mb-3">
      <CardContent className="p-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <canvas 
            ref={micVizRef} 
            width="220" 
            height="20" 
            className="w-[150px] h-5 bg-transparent rounded"
            aria-label="microphone activity"
            title="Microphone activity"
          />
          <Badge variant="secondary" className="font-mono text-xs min-w-[80px] text-center">
            {detectedFreq}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Audio: {audioLevel}%
          </Badge>
          {fps && (
            <Badge variant="outline" className="text-xs">
              {fps}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AudioVisualizer

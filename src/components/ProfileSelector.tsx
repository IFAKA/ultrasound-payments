import { ProfileType } from '../types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProfileSelectorProps {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
  disabled?: boolean
}

const ProfileSelector = ({ profile, onProfileChange, disabled = false }: ProfileSelectorProps) => {
  const profiles: { value: ProfileType; label: string }[] = [
    { value: 'ultrasonic', label: 'Standard Ultrasonic (~19kHz)' },
    { value: 'audible', label: 'Feature Phone Compatible (~4.2kHz)' }
  ]

  return (
    <div className="profile-selector">
      <Select value={profile} onValueChange={onProfileChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select profile" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default ProfileSelector

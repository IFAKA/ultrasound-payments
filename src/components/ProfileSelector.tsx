import { ProfileType } from '../types'

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
      <select 
        value={profile} 
        onChange={(e) => onProfileChange(e.target.value as ProfileType)}
        disabled={disabled}
      >
        {profiles.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ProfileSelector

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
        className="bg-gray-800 border border-gray-700 text-gray-100 px-4 py-2 rounded-lg text-sm w-full text-center disabled:opacity-50 disabled:cursor-not-allowed"
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

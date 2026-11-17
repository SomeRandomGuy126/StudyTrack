import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Props = { displayName?: string; size?: number };

export function AvatarPicker({ displayName, size = 96 }: Props) {
  const { user, profile, updateProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = profile?.avatar_url ?? null;
  const initial = (displayName?.trim() || profile?.display_name?.trim() || user?.email || 'U').charAt(0).toUpperCase();

  const uploadAvatar = async (file?: File) => {
    if (!file || !user) return;
    setMessage('');
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      setMessage('Please choose a JPG, PNG, GIF or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage('Choose an image smaller than 3 MB.');
      return;
    }
    setUploading(true);
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const oldPath = avatarUrl?.includes('/avatars/') ? decodeURIComponent(avatarUrl.split('/avatars/')[1].split('?')[0]) : null;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600', contentType: file.type, upsert: false,
    });
    if (uploadError) {
      setMessage(uploadError.message.toLowerCase().includes('bucket not found')
        ? 'Profile-picture storage is not set up in Supabase yet. The avatars bucket must be created before uploads can work.'
        : uploadError.message);
      setUploading(false);
      return;
    }
    const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error: profileError } = await updateProfile({ avatar_url: publicUrl });
    if (profileError) {
      await supabase.storage.from('avatars').remove([path]);
      setMessage(profileError);
      setUploading(false);
      return;
    }
    if (oldPath && oldPath !== path) await supabase.storage.from('avatars').remove([oldPath]);
    setMessage('Profile picture updated.');
    setUploading(false);
  };

  const removeAvatar = async () => {
    if (!user || !avatarUrl) return;
    setUploading(true);
    const oldPath = avatarUrl.includes('/avatars/') ? decodeURIComponent(avatarUrl.split('/avatars/')[1].split('?')[0]) : null;
    const { error } = await updateProfile({ avatar_url: null });
    if (error) setMessage(error);
    else {
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      setMessage('Profile picture removed. Your initial is showing instead.');
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="rounded-full overflow-hidden bg-brand-500 text-white flex items-center justify-center font-semibold shadow-sm shrink-0"
        style={{ width: size, height: size, fontSize: Math.max(22, size * 0.36) }}>
        {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" /> : initial}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-secondary">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {avatarUrl ? 'Change photo' : 'Choose photo'}
          </button>
          {avatarUrl && <button type="button" onClick={removeAvatar} disabled={uploading} className="btn btn-ghost text-red-600"><Trash2 size={16} /> Remove</button>}
        </div>
        <p className="text-xs text-tertiary">Optional · JPG, PNG, GIF or WebP · Max 3 MB</p>
        {message && <p className="text-xs text-secondary" role="status">{message}</p>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.target.value = ''; }} />
      </div>
    </div>
  );
}

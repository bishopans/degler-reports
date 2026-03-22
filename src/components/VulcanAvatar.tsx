// Vulcan Avatar — Roman god of the forge
// Uses custom PNG image
import Image from 'next/image';

export default function VulcanAvatar({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/images/VulcanAIAvatar.png"
      alt="Vulcan AI Assistant"
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        objectPosition: 'top center',
      }}
    />
  );
}

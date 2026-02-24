'use client';

import { useState, useEffect } from 'react';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';

export default function LoaderPreviewPage() {
    const [renderKey, setRenderKey] = useState(0);

    useEffect(() => {
        // Re-mount the component every 4 seconds to replay the animation
        const interval = setInterval(() => {
            setRenderKey(prev => prev + 1);
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-screen">
            <div className="absolute top-4 left-4 z-[100] bg-black/50 text-white px-4 py-2 rounded-lg text-sm backdrop-blur border border-white/10 font-medium font-mono shadow-xl">
                Previewing Animation... (Loops every 4s)
            </div>

            {/* Changing the key forces React to unmount and remount, triggering the Framer Motion initial variants again */}
            <EditorLoadingScreen key={renderKey} />
        </div>
    );
}

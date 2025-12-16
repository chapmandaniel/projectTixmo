import React, { useState } from 'react';
import CreativeControls from './CreativeControls';
import CreativePreview from './CreativePreview';

const CreativeComposer = ({ isDark }) => {
    const [prompt, setPrompt] = useState('');
    const [weights, setWeights] = useState({
        vibrancy: 75,
        professionalism: 40,
        humor: 20,
        creativity: 80
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null);

    const handleGenerate = () => {
        setIsGenerating(true);

        // Simulate AI generation delay
        setTimeout(() => {
            setResult({
                text: `Experience the magic of summer like never before! 🌟 Our festival brings together the hottest acts and the coolest vibes. Don't miss out on the event of the year! 🎵✨`,
                imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                hashtags: ['#SummerFest', '#LiveMusic', '#FestivalVibes', '#MusicLover']
            });
            setIsGenerating(false);
        }, 2500);
    };

    return (
        <div className="h-[calc(100vh-8rem)] animate-fade-in max-w-7xl mx-auto">
            <div className="mb-6">
                <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Creative Composer</h2>
                <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>
                    Harness the power of AI to generate stunning social content tailored to your brand voice.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-6">
                {/* Left Panel - Controls */}
                <div className="lg:col-span-5 h-full">
                    <CreativeControls
                        prompt={prompt}
                        setPrompt={setPrompt}
                        weights={weights}
                        setWeights={setWeights}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        isDark={isDark}
                    />
                </div>

                {/* Right Panel - Preview */}
                <div className="lg:col-span-7 h-full">
                    <CreativePreview
                        result={result}
                        isGenerating={isGenerating}
                        isDark={isDark}
                    />
                </div>
            </div>
        </div>
    );
};

export default CreativeComposer;

import React, { useState } from 'react';
import CreativeControls from './CreativeControls';
import CreativePreview from './CreativePreview';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

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

    const handleGenerate = async () => {
        setIsGenerating(true);
        setResult(null);

        try {
            const response = await api.post('/ai/generate', {
                prompt,
                weights
            });

            if (response.data.success) {
                setResult(response.data.data);
                toast.success('Content generated successfully!');
            }
        } catch (error) {
            console.error('Generation failed:', error);
            toast.error('Failed to generate content. Please try again.');
        } finally {
            setIsGenerating(false);
        }
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

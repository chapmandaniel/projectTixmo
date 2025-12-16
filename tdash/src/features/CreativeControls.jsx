import React from 'react';
import { Sliders, Sparkles } from 'lucide-react';

const CreativeControls = ({ prompt, setPrompt, weights, setWeights, onGenerate, isGenerating, isDark }) => {
    const handleWeightChange = (key, value) => {
        setWeights(prev => ({ ...prev, [key]: parseInt(value) }));
    };

    const sliders = [
        { key: 'vibrancy', label: 'Vibrancy', min: 0, max: 100 },
        { key: 'professionalism', label: 'Professionalism', min: 0, max: 100 },
        { key: 'humor', label: 'Humor', min: 0, max: 100 },
        { key: 'creativity', label: 'Creativity', min: 0, max: 100 },
    ];

    return (
        <div className={`p-6 rounded-2xl h-full flex flex-col ${isDark ? 'bg-[#1e1e1e]' : 'bg-white shadow-sm'}`}>
            <div className="flex items-center space-x-2 mb-6">
                <Sliders size={20} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Configuration</h3>
            </div>

            {/* Prompt Input */}
            <div className="mb-8">
                <label className={`block text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Content Prompt
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the content you want to generate (e.g., 'A promotional post for our summer festival lineup...')"
                    className={`w-full h-32 p-4 rounded-xl resize-none outline-none transition-all border ${isDark
                            ? 'bg-[#252525] border-[#333] text-gray-200 focus:border-indigo-500/50'
                            : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                        }`}
                />
            </div>

            {/* Sliders */}
            <div className="space-y-6 mb-8 flex-1">
                <label className={`block text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Style Weights
                </label>
                {sliders.map(({ key, label, min, max }) => (
                    <div key={key} className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
                            <span className={`font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{weights[key]}%</span>
                        </div>
                        <input
                            type="range"
                            min={min}
                            max={max}
                            value={weights[key]}
                            onChange={(e) => handleWeightChange(key, e.target.value)}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                ))}
            </div>

            {/* Generate Button */}
            <button
                onClick={onGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={`w-full py-4 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all ${isGenerating || !prompt.trim()
                        ? (isDark ? 'bg-[#333] text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98]'
                    }`}
            >
                {isGenerating ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={18} />
                        <span>Generate Creative</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default CreativeControls;

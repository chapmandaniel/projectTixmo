import React from 'react';
import { Copy, RefreshCw, Share2, Image as ImageIcon } from 'lucide-react';

const CreativePreview = ({ result, isGenerating, isDark }) => {
    if (isGenerating) {
        return (
            <div className={`h-full rounded-2xl flex flex-col items-center justify-center p-8 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white shadow-sm'}`}>
                <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full animate-spin border-t-transparent"></div>
                </div>
                <h3 className={`text-xl font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Crafting your content...</h3>
                <p className={`text-center max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Our AI is analyzing your weights and generating the perfect creative assets.
                </p>
            </div>
        );
    }

    if (!result) {
        return (
            <div className={`h-full rounded-2xl flex flex-col items-center justify-center p-8 border-2 border-dashed ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-[#252525] text-gray-600' : 'bg-gray-200 text-gray-400'}`}>
                    <ImageIcon size={32} />
                </div>
                <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Enter a prompt and adjust the sliders to generate a preview.
                </p>
            </div>
        );
    }

    return (
        <div className={`h-full rounded-2xl flex flex-col ${isDark ? 'bg-[#1e1e1e]' : 'bg-white shadow-sm'}`}>
            <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                <h3 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Generated Preview</h3>
                <div className="flex space-x-2">
                    <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} title="Copy Text">
                        <Copy size={18} />
                    </button>
                    <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} title="Regenerate">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Mock Image Preview */}
                <div className="aspect-video w-full rounded-xl overflow-hidden relative group">
                    <img
                        src={result.imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"}
                        alt="Generated Creative"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium text-sm">
                            Download Asset
                        </button>
                    </div>
                </div>

                {/* Generated Text */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                    <p className={`leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {result.text}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {result.hashtags.map(tag => (
                            <span key={tag} className={`text-xs px-2 py-1 rounded-md ${isDark ? 'bg-[#333] text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className={`p-6 border-t ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20">
                    <Share2 size={18} />
                    <span>Schedule Post</span>
                </button>
            </div>
        </div>
    );
};

export default CreativePreview;

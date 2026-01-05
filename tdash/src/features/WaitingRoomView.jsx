import React from 'react';
import { Users, RotateCcw } from 'lucide-react';

const WaitingRoomView = ({ onRetry }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a] text-white">
            <div className="max-w-md w-full p-8 text-center animate-fade-in">
                <div className="mb-8 relative inline-block">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
                    <div className="relative bg-[#1a1a1a] p-6 rounded-full border border-white/10">
                        <Users size={48} className="text-indigo-400" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    You are in line
                </h1>

                <p className="text-white/60 mb-8 text-lg leading-relaxed">
                    We're experiencing higher than normal traffic. <br />
                    Please wait a moment while we make room for you.
                </p>

                <div className="flex justify-center">
                    <button
                        onClick={onRetry}
                        className="group flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all hover:scale-105 active:scale-95"
                    >
                        <RotateCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                        Try Again
                    </button>
                </div>

                <p className="mt-8 text-xs text-white/20">
                    Do not refresh the page significantly or you may lose your place.
                </p>
            </div>
        </div>
    );
};

export default WaitingRoomView;

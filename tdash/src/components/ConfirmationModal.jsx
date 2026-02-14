import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger', // danger, warning, info
    isLoading = false
}) => {
    const modalRef = useRef(null);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen && !isLoading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, isLoading]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
            buttonConfirm: 'bg-red-600 hover:bg-red-700 text-white',
            bgIcon: 'bg-red-500/10'
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6 text-orange-500" />,
            buttonConfirm: 'bg-orange-600 hover:bg-orange-700 text-white',
            bgIcon: 'bg-orange-500/10'
        },
        info: {
            icon: <Info className="w-6 h-6 text-blue-500" />,
            buttonConfirm: 'bg-blue-600 hover:bg-blue-700 text-white',
            bgIcon: 'bg-blue-500/10'
        },
        success: {
            icon: <CheckCircle className="w-6 h-6 text-green-500" />,
            buttonConfirm: 'bg-green-600 hover:bg-green-700 text-white',
            bgIcon: 'bg-green-500/10'
        }
    };

    const style = variantStyles[variant] || variantStyles.danger;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div
                ref={modalRef}
                className="bg-[#1A1A1A] border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl transform transition-all animate-scale-in"
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full shrink-0 ${style.bgIcon}`}>
                        {style.icon}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                        <div className="text-gray-400 text-sm leading-relaxed mb-6">
                            {message}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => onConfirm()}
                                disabled={isLoading}
                                className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-2 ${style.buttonConfirm}`}
                            >
                                {isLoading && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;

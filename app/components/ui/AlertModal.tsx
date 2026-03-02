import React from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
}

export default function AlertModal({ isOpen, title, message, type = 'info', onClose }: AlertModalProps) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                );
            case 'error':
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                        <X className="w-8 h-8 text-red-600" />
                    </div>
                );
            default:
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <AlertCircle className="w-8 h-8 text-blue-600" />
                    </div>
                );
        }
    };

    const getDefaultTitle = () => {
        switch (type) {
            case 'success': return 'Success!';
            case 'error': return 'Error';
            default: return 'Notice';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4 text-center">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in-95 duration-200">
                <div className="mb-2">
                    {getIcon()}
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{title || getDefaultTitle()}</h2>
                </div>
                <p className="text-slate-600 mb-8 font-medium">{message}</p>
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}

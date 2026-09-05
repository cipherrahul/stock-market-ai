'use client';

import React, { useState, useEffect } from 'react';
import { FiActivity, FiServer, FiCpu, FiShield, FiAlertCircle } from 'react-icons/fi';

interface ServiceStatus {
    id: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
    latency: number;
}

const getServiceIcon = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes('AUTH')) return <FiShield className="text-sky-400" />;
    if (n.includes('MARKET')) return <FiActivity className="text-emerald-400" />;
    if (n.includes('AI') || n.includes('ORCHESTRATOR')) return <FiCpu className="text-purple-400" />;
    if (n.includes('EXEC') || n.includes('TRADING')) return <FiServer className="text-amber-400" />;
    return <FiServer className="text-slate-400" />;
};

export const FleetTelemetry: React.FC = () => {
    const [services, setServices] = useState<ServiceStatus[]>([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const fetchHealth = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            try {
                // Try Trading Service fleet health or Gateway health
                const res = await fetch(`${apiUrl}/api/v1/fleet/health`).catch(() => 
                    fetch('http://localhost:3006/api/v1/fleet/health')
                );
                
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                if (data.services && Array.isArray(data.services) && data.services.length > 0) {
                    setServices(data.services.map((s: any) => ({
                        id: s.service_name,
                        name: s.service_name.replace(/_/g, ' '),
                        status: s.status || 'ONLINE',
                        latency: typeof s.latency_ms === 'number' ? s.latency_ms : 0,
                    })));
                    setConnected(true);
                } else {
                    setConnected(false);
                    setServices([]);
                }
            } catch (err) {
                // True state: Not connected. Zero mock fallbacks.
                setConnected(false);
                setServices([]);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 8000);
        return () => clearInterval(interval);
    }, []);

    if (!connected || services.length === 0) {
        return (
            <div className="flex items-center gap-2 px-6 py-2 border-x border-white/5 bg-white/[0.01] text-xs text-slate-400 font-mono">
                <FiAlertCircle className="text-amber-400 animate-pulse" />
                <span className="text-[10px] tracking-wider uppercase">Telemetry Stream: Connecting to Fleet...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-8 px-8 py-3 border-x border-white/5 bg-white/[0.02]">
            {services.map((service, idx) => (
                <div key={service.id} className="flex items-center gap-3">
                    <div className="relative">
                        {getServiceIcon(service.name)}
                        <div className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${
                            service.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'
                        } animate-pulse`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{service.name}</span>
                        <span className="text-[10px] font-mono font-bold text-white/50">{service.latency.toFixed(0)}MS</span>
                    </div>
                    {idx < services.length - 1 && (
                        <div className="h-4 w-[1px] bg-white/5 ml-4" />
                    )}
                </div>
            ))}
        </div>
    );
};

import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/bookings/slots?siteId=...&date=YYYY-MM-DD&serviceId=...
 * 
 * Calculate available time slots for a given date and service.
 * 
 * Algorithm:
 * 1. Get the availability rule for this day-of-week
 * 2. Check if the date is blocked
 * 3. Generate all possible slots based on service duration + buffer
 * 4. Remove slots that overlap with existing bookings
 * 5. Return available start times
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const date = request.nextUrl.searchParams.get('date'); // YYYY-MM-DD
    const serviceId = request.nextUrl.searchParams.get('serviceId');

    if (!siteId || !date || !serviceId) {
        return NextResponse.json({ error: 'Missing siteId, date, or serviceId' }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get the service to know the duration
    const { data: service, error: svcError } = await supabase
        .from('booking_services')
        .select('duration_minutes')
        .eq('id', serviceId)
        .eq('is_active', true)
        .single();

    if (svcError || !service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // 2. Get booking settings for buffer time
    const { data: settings } = await supabase
        .from('booking_settings')
        .select('buffer_minutes, timezone')
        .eq('site_id', siteId)
        .single();

    const bufferMinutes = settings?.buffer_minutes ?? 15;

    // 3. Check what day-of-week this date is
    const dateObj = new Date(date + 'T12:00:00'); // noon to avoid timezone issues
    const dayOfWeek = dateObj.getDay(); // 0=Sunday

    // 4. Get availability for this day
    const { data: availability } = await supabase
        .from('booking_availability')
        .select('start_time, end_time, is_active')
        .eq('site_id', siteId)
        .eq('day_of_week', dayOfWeek)
        .single();

    if (!availability || !availability.is_active) {
        return NextResponse.json({ slots: [], message: 'Not available on this day' });
    }

    // 5. Check if this date is blocked
    const { data: blocked } = await supabase
        .from('booking_blocked_dates')
        .select('id')
        .eq('site_id', siteId)
        .eq('blocked_date', date)
        .limit(1);

    if (blocked && blocked.length > 0) {
        return NextResponse.json({ slots: [], message: 'This date is blocked' });
    }

    // 6. Get existing bookings for this date
    const { data: existingBookings } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('site_id', siteId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed']);

    // 7. Generate all possible slots
    const slots = generateSlots(
        availability.start_time,
        availability.end_time,
        service.duration_minutes,
        bufferMinutes,
        existingBookings || []
    );

    // 8. Filter out past slots if the date is today
    const today = new Date().toISOString().split('T')[0];
    let availableSlots = slots;
    if (date === today) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        availableSlots = slots.filter(slot => timeToMinutes(slot.startTime) > currentMinutes + 30); // 30 min minimum advance
    }

    return NextResponse.json({ slots: availableSlots });
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

interface Booking {
    start_time: string;
    end_time: string;
}

interface Slot {
    startTime: string;
    endTime: string;
    display: string; // e.g. "9:00 AM"
}

function generateSlots(
    dayStart: string,
    dayEnd: string,
    durationMinutes: number,
    bufferMinutes: number,
    existingBookings: Booking[]
): Slot[] {
    const startMin = timeToMinutes(dayStart);
    const endMin = timeToMinutes(dayEnd);
    const slotStep = durationMinutes + bufferMinutes;
    const slots: Slot[] = [];

    for (let t = startMin; t + durationMinutes <= endMin; t += slotStep) {
        const slotStart = minutesToTime(t);
        const slotEnd = minutesToTime(t + durationMinutes);

        // Check for overlap with existing bookings
        const hasConflict = existingBookings.some(booking => {
            const bStart = timeToMinutes(booking.start_time);
            const bEnd = timeToMinutes(booking.end_time);
            const sStart = t;
            const sEnd = t + durationMinutes;
            // Overlap exists if one starts before the other ends
            return sStart < bEnd + bufferMinutes && sEnd + bufferMinutes > bStart;
        });

        if (!hasConflict) {
            slots.push({
                startTime: slotStart,
                endTime: slotEnd,
                display: formatTime(slotStart),
            });
        }
    }

    return slots;
}

function formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

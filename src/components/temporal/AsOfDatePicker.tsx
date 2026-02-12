/**
 * AsOfDatePicker Component
 * Allows users to select a historical date to view data "as of" that date
 */

'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AsOfDatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function AsOfDatePicker({
  date,
  onDateChange,
  minDate,
  maxDate = new Date(),
  className,
}: AsOfDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleReset = () => {
    onDateChange(undefined);
    setOpen(false);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={date ? 'secondary' : 'outline'}
            className={cn(
              'justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : 'View as of date...'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              onDateChange(newDate);
              setOpen(false);
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
          />
          <div className="border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              View Current State
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      {date && (
        <div className="text-sm text-muted-foreground">
          Viewing data as it was on {format(date, 'PPP')}
        </div>
      )}
    </div>
  );
}

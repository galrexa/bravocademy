interface ExamTimerProps {
  /** Total duration in seconds */
  durationSeconds: number;
  /** ISO string of when the exam started */
  startedAt: string;
}

export default function ExamTimer({ durationSeconds, startedAt }: ExamTimerProps) {
  const elapsedSeconds = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000
  );
  const remaining = Math.max(0, durationSeconds - elapsedSeconds);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="font-mono text-lg tabular-nums" aria-label="Time remaining">
      {display}
    </div>
  );
}

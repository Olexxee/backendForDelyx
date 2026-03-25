import { tournamentQueue } from "../queues/tournamentQueue.js";

const getDelay = (dateLike) => {
  return Math.max(new Date(dateLike).getTime() - Date.now(), 0);
};

export const scheduleTournamentJobs = async (tournament) => {
  const tournamentId = tournament._id.toString();

  const jobs = [];

  if (tournament.registrationDeadline) {
    jobs.push(
      tournamentQueue.add(
        "TOURNAMENT_AUTO_START",
        { tournamentId },
        {
          jobId: `tournament:${tournamentId}:auto-start`,
          delay: getDelay(tournament.registrationDeadline),
        },
      ),
    );
  }

  if (tournament.endDate) {
    jobs.push(
      tournamentQueue.add(
        "TOURNAMENT_AUTO_COMPLETE",
        { tournamentId },
        {
          jobId: `tournament:${tournamentId}:auto-complete`,
          delay: getDelay(tournament.endDate),
        },
      ),
    );
  }

  await Promise.all(jobs);
};

export const unscheduleTournamentJobs = async (tournamentId) => {
  const jobIds = [
    `tournament:${tournamentId}:auto-start`,
    `tournament:${tournamentId}:auto-complete`,
  ];

  await Promise.all(
    jobIds.map(async (jobId) => {
      const job = await tournamentQueue.getJob(jobId);
      if (job) await job.remove();
    }),
  );
};

export const rescheduleTournamentJobs = async (tournament) => {
  await unscheduleTournamentJobs(tournament._id.toString());
  await scheduleTournamentJobs(tournament);
};
import Tournament from "./tournamentSchema.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

// ============================================================
// CREATE
// ============================================================

export const createTournament = async (payload, options = {}) => {
  const { session } = options;

  const [tournament] = await Tournament.create([payload], { session });
  return tournament;
};

// ============================================================
// FIND
// ============================================================

export const findTournamentById = async (tournamentId, options = {}) => {
  const { session, populate = [] } = options;

  let query = Tournament.findById(tournamentId).session(session || null);

  for (const item of populate) {
    query = query.populate(item);
  }

  return query;
};

export const findTournamentByCode = async (tournamentCode, options = {}) => {
  const { session, populate = [] } = options;

  let query = Tournament.findOne({ tournamentCode }).session(session || null);

  for (const item of populate) {
    query = query.populate(item);
  }

  return query;
};

export const findTournamentsByStatus = async (status, options = {}) => {
  const { session } = options;

  return Tournament.find({ status }).session(session || null);
};

export const findAllTournaments = async (
  { page = 1, limit = 10, status } = {},
  options = {},
) => {
  const { session, sort = { createdAt: -1 } } = options;

  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [tournaments, total] = await Promise.all([
    Tournament.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .session(session || null),
    Tournament.countDocuments(filter).session(session || null),
  ]);

  return {
    tournaments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

export const countTournaments = async (filter = {}, options = {}) => {
  const { session } = options;
  return Tournament.countDocuments(filter).session(session || null);
};

export const findGroupTournaments = async (groupId, status, options = {}) => {
  const { session, populate = [] } = options;

  const filter = { groupId };
  if (status) filter.status = status;

  let query = Tournament.find(filter)
    .sort({ createdAt: -1 })
    .session(session || null);

  for (const item of populate) {
    query = query.populate(item);
  }

  return query;
};

export const findTournamentByNameInGroup = async (
  { name, groupId },
  options = {},
) => {
  const { session } = options;
  const regex = new RegExp(`^${name.trim()}$`, "i");

  return Tournament.findOne({
    name: regex,
    groupId,
    status: { $ne: "cancelled" },
  }).session(session || null);
};

// ============================================================
// UPDATE
// ============================================================

export const updateTournamentById = async (
  tournamentId,
  updatePayload,
  options = {},
) => {
  const { session, new: returnNew = true, runValidators = true } = options;

  return Tournament.findByIdAndUpdate(tournamentId, updatePayload, {
    new: returnNew,
    runValidators,
    session,
  });
};

export const saveTournament = async (tournament) => {
  return tournament.save();
};

// ============================================================
// PARTICIPANTS
// ============================================================

export const addParticipant = async (
  tournamentId,
  userId,
  options = {},
) => {
  const { session, participantStatus = "registered" } = options;

  return Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      "participants.userId": { $ne: userId },
    },
    {
      $push: {
        participants: {
          userId,
          status: participantStatus,
        },
      },
      $inc: { currentParticipants: 1 },
    },
    {
      new: true,
      session,
    },
  );
};

export const removeParticipant = async (tournamentId, userId, options = {}) => {
  const { session } = options;

  const tournament = await Tournament.findById(tournamentId).session(session);

  if (!tournament) return null;

  tournament.participants = tournament.participants.filter(
    (participant) => participant.userId?.toString() !== userId.toString(),
  );

  tournament.currentParticipants = tournament.participants.length;

  await tournament.save({ session });

  return tournament;
};

export const findUserInTournament = async (
  tournamentId,
  userId,
  options = {},
) => {
  const { session } = options;

  return Tournament.findOne({
    _id: tournamentId,
    "participants.userId": userId,
  }).session(session || null);
};

export const getTournamentParticipants = async (
  tournamentId,
  options = {},
) => {
  const { session } = options;

  return Tournament.findById(tournamentId)
    .select("participants currentParticipants maxParticipants")
    .populate({
      path: "participants.userId",
      select: "username email profilePicture",
    })
    .session(session || null);
};

export const updateParticipantStatus = async (
  tournamentId,
  userId,
  status,
  options = {},
) => {
  const { session } = options;

  return Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      "participants.userId": userId,
    },
    {
      $set: { "participants.$.status": status },
    },
    {
      new: true,
      session,
    },
  );
};

export const getUserRoleInTournament = async (
  tournamentId,
  userId,
  options = {},
) => {
  const { session } = options;

  const tournament = await Tournament.findById(tournamentId)
    .select("participants")
    .session(session || null);

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const participant = tournament.participants.find(
    (entry) => entry.userId.toString() === userId.toString(),
  );

  return participant?.status ?? null;
};



// ============================================================
// USER TOURNAMENT QUERIES
// ============================================================

export const findUserActiveTournaments = async (userId, options = {}) => {
  const { session } = options;

  return Tournament.find({
    "participants.userId": userId,
    status: { $in: ["registration", "ongoing"] },
  })
    .populate("groupId", "groupName")
    .session(session || null);
};

export const findUserTournaments = async (
  userId,
  options = {},
) => {
  const {
    session,
    participantStatuses = ["registered", "confirmed"],
  } = options;

  return Tournament.find({
    "participants.userId": userId,
    "participants.status": { $in: participantStatuses },
    status: { $in: ["registration", "ongoing"] },
  })
    .populate("groupId", "groupName")
    .select("name status startDate endDate currentMatchday totalMatchdays")
    .session(session || null);
};

// ============================================================
// CAPACITY
// ============================================================

export const checkTournamentCapacity = async (
  tournamentId,
  options = {},
) => {
  const { session } = options;

  const tournament = await Tournament.findById(tournamentId)
    .select("currentParticipants maxParticipants")
    .session(session || null);

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  return {
    isFull: tournament.currentParticipants >= tournament.maxParticipants,
    availableSlots: tournament.maxParticipants - tournament.currentParticipants,
    currentParticipants: tournament.currentParticipants,
    maxParticipants: tournament.maxParticipants,
  };
};
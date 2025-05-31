import { Request, Response  } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const handleIdentify  = async (req: Request, res: Response): Promise<void> => {
  try {
    let { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
       res.status(400).json({ error: 'email or phoneNumber required' });
       return;
    }

    if (email) email = email.trim().toLowerCase();
    if (phoneNumber) phoneNumber = phoneNumber.toString().trim();

    // Step 1: Find contacts matching email or phoneNumber
    const matchedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined,
        ].filter(Boolean) as Prisma.ContactWhereInput[],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Step 2: Collect all primary IDs from matched contacts and their linked IDs
    const primaryIds = new Set<number>();

    for (const contact of matchedContacts) {
      if (contact.linkPrecedence === 'PRIMARY') {
        primaryIds.add(contact.id);
      } else if (contact.linkedId) {
        primaryIds.add(contact.linkedId);
      }
    }

    // Step 3: Fetch all contacts linked to those primary IDs
    const allRelatedContacts = primaryIds.size > 0
      ? await prisma.contact.findMany({
          where: {
            OR: [
              { id: { in: Array.from(primaryIds) } },
              { linkedId: { in: Array.from(primaryIds) } },
            ],
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Step 4: Identify oldest primary contact (lowest createdAt)
    let primaryContact: typeof allRelatedContacts[0] | null = null;
    if (allRelatedContacts.length > 0) {
      primaryContact = allRelatedContacts
        .filter(c => c.linkPrecedence === 'PRIMARY')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    }

    // Step 5: If no primary found and no matched contacts, create new primary
    if (!primaryContact && matchedContacts.length === 0) {
      primaryContact = await prisma.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          linkPrecedence: 'PRIMARY',
        },
      });
    }

    // Step 6: If multiple primaries, demote all but oldest to secondary linked to primaryContact
    if (primaryContact) {
      for (const contact of allRelatedContacts) {
        if (
          contact.linkPrecedence === 'PRIMARY' &&
          contact.id !== primaryContact.id
        ) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              linkPrecedence: 'SECONDARY',
              linkedId: primaryContact.id,
            },
          });
        }
      }
    }

    // Step 7: Reload all related contacts after potential updates
    const finalContacts = primaryContact
      ? await prisma.contact.findMany({
          where: {
            OR: [
              { id: primaryContact.id },
              { linkedId: primaryContact.id },
            ],
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Step 8: Check if the exact contact already exists in finalContacts
    const exactContactExists = finalContacts.some(c => {
      if (email && phoneNumber) {
        return c.email === email && c.phoneNumber === phoneNumber;
      } else if (email) {
        return c.email === email;
      } else if (phoneNumber) {
        return c.phoneNumber === phoneNumber;
      }
      return false;
    });

    // Step 9: If no exact contact found, create secondary linked to primary
    if (!exactContactExists && primaryContact) {
      await prisma.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          linkPrecedence: 'SECONDARY',
          linkedId: primaryContact.id,
        },
      });

      // Reload final contacts after creation
      finalContacts.push(
        await prisma.contact.findFirst({
          where: {
            email,
            phoneNumber,
            linkedId: primaryContact.id,
          },
          orderBy: { createdAt: 'asc' },
        }) as any
      );
    }

    // Prepare response arrays with unique emails and phoneNumbers
    const emails = Array.from(new Set(finalContacts.map(c => c.email).filter(Boolean)));
    const phoneNumbers = Array.from(new Set(finalContacts.map(c => c.phoneNumber).filter(Boolean)));
    const secondaryContactIds = finalContacts
      .filter(c => c.linkPrecedence === 'SECONDARY')
      .map(c => c.id);

    res.status(200).json({
      contact: {
        primaryContactId: primaryContact?.id ?? null,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });
    return ;
  } catch (err) {
    console.error('Identify Error:', err);
     res.status(500).json({ error: 'Internal Server Error' });
     return;
  }
};

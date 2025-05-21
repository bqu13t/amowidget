import { NextResponse } from 'next/server';

type User = {
  id: number;
  name: string;
};

type Lead = {
  responsible_user_id: number;
};

type Pipeline = {
  id: number;
  name: string;
};

export async function GET() {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.AMO_SECRET_TOKEN}`,
      'Content-Type': 'application/json',
    };

    // Получаем пользователей
    const usersResponse = await fetch(`${process.env.AMO_BASE_URL}/api/v4/users`, { headers });
    const usersData = await usersResponse.json();

    // Получаем сделки
    const leadsResponse = await fetch(
      `${process.env.AMO_BASE_URL}/api/v4/leads?with=custom_fields`,
      { headers }
    );
    const leadsData = await leadsResponse.json();

    // Получаем воронки
    const pipelinesResponse = await fetch(`${process.env.AMO_BASE_URL}/api/v4/leads/pipelines`, {
      headers,
    });
    const pipelinesData = await pipelinesResponse.json();

    // Защита от ошибок структуры
    const rawPipelines = pipelinesData._embedded?.pipelines;
    if (!Array.isArray(rawPipelines)) {
      return NextResponse.json(
        { error: 'Ошибка структуры данных воронок AmoCRM' },
        { status: 500 }
      );
    }

    const pipelines = rawPipelines.map((pipeline: Pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
    }));

    const usersWithLeads = usersData._embedded.users.map((user: User) => ({
      ...user,
      leads: leadsData._embedded.leads.filter((lead: Lead) => lead.responsible_user_id === user.id),
    }));

    return NextResponse.json({
      users: usersWithLeads,
      pipelines,
    });

  } catch (error) {
    console.error("Ошибка при загрузке данных из AmoCRM:", error);
    return NextResponse.json(
      { error: 'Ошибка получения данных' },
      { status: 500 }
    );
  }
}

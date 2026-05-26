import type { FoundyItem } from '@/types/foundy'

export const mockItems: FoundyItem[] = [
  {
    id: '1',
    title: 'Chave com chaveiro azul',
    description: 'Encontrada próxima à saída principal da estação.',
    category: 'chaves',
    latitude: -23.5489,
    longitude: -46.6372,
    locationLabel: 'Próximo à estação',
    locationRadiusMeters: 500,
    isPremium: true,
  },
  {
    id: '2',
    title: 'Carteira preta',
    description: 'Carteira pequena deixada em uma cafeteria da região.',
    category: 'documentos',
    latitude: -23.5533,
    longitude: -46.6312,
    locationLabel: 'Região da praça',
    locationRadiusMeters: 500,
    isPremium: false,
  },
  {
    id: '3',
    title: 'Fone sem fio',
    description: 'Estojo branco encontrado em banco de praça.',
    category: 'eletronicos',
    latitude: -23.5561,
    longitude: -46.642,
    locationLabel: 'Perto da praça central',
    locationRadiusMeters: 500,
    isPremium: false,
  },
]

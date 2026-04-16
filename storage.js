/**
 * Storage Manager - Soporta LocalStorage y Supabase para sincronización entre PCs
 */

const USE_SUPABASE = true; // Cambiar a true cuando se configuren las claves
const SUPABASE_URL = 'https://sitdoxagtvteofggqznu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdGRveGFndHZ0ZW9mZ2dxem51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjAxMjYsImV4cCI6MjA5MTg5NjEyNn0.1fQfF2OVSVVFcDWABQvAHr7o2XgMmLHOp2JRlHhkcl0';

let supabaseClient = null;

if (USE_SUPABASE && typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

const StorageManager = {
    async loadData() {
        if (USE_SUPABASE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('cabinas')
                .select('*')
                .order('order_index', { ascending: true });
            
            if (error) {
                console.error('Error cargando de Supabase:', error);
                return this.loadLocal();
            }
            // Mapear de base de datos a formato de la app
            return data.map(item => ({
                id: item.cabin_id,
                status: item.status,
                endTime: item.end_time ? new Date(item.end_time).getTime() : null
            }));
        }
        return this.loadLocal();
    },

    loadLocal() {
        return JSON.parse(localStorage.getItem('cabinsData')) || [];
    },

    async saveData(cabinsData) {
        if (USE_SUPABASE && supabaseClient) {
            // En Supabase lo ideal es actualizar fila por fila o usar un upsert
            // Para simplicidad en este ejemplo, borramos e insertamos (o usamos upsert masivo)
            const upsertData = cabinsData.map((cabin, index) => ({
                cabin_id: cabin.id,
                status: cabin.status,
                end_time: cabin.endTime ? new Date(cabin.endTime).toISOString() : null,
                order_index: index
            }));

            const { error } = await supabaseClient
                .from('cabinas')
                .upsert(upsertData, { onConflict: 'cabin_id' });

            if (error) console.error('Error guardando en Supabase:', error);
        }
        
        localStorage.setItem('cabinsData', JSON.stringify(cabinsData));
        window.dispatchEvent(new Event('storage'));
    },

    onSync(callback) {
        if (USE_SUPABASE && supabaseClient) {
            // Suscribirse a cambios en tiempo real
            supabaseClient
                .channel('public:cabinas')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'cabinas' }, async () => {
                    const newData = await this.loadData();
                    callback(newData);
                })
                .subscribe();
        }
        
        window.addEventListener('storage', async () => {
            const newData = await this.loadData();
            callback(newData);
        });
    }
};

window.StorageManager = StorageManager;

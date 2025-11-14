import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Filter, Search, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema, type InsertTransaction, CATEGORIES } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function TransactionsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();

  // Mock transactions - will be replaced with real data in Task 3
  const transactions = [
    { id: "1", description: "Salário", category: "Salário", type: "entrada", amount: "5000.00", date: new Date("2025-01-10"), accountId: "1" },
    { id: "2", description: "Supermercado Pão de Açúcar", category: "Alimentação", type: "saida", amount: "320.50", date: new Date("2025-01-09"), accountId: "1" },
    { id: "3", description: "Freelance Design", category: "Freelance", type: "entrada", amount: "1500.00", date: new Date("2025-01-08"), accountId: "1" },
    { id: "4", description: "Academia SmartFit", category: "Saúde", type: "saida", amount: "89.90", date: new Date("2025-01-07"), accountId: "1" },
    { id: "5", description: "Uber - Centro", category: "Transporte", type: "saida", amount: "45.00", date: new Date("2025-01-07"), accountId: "1" },
    { id: "6", description: "Netflix", category: "Lazer", type: "saida", amount: "39.90", date: new Date("2025-01-05"), accountId: "1" },
    { id: "7", description: "Venda Produto", category: "Vendas", type: "entrada", amount: "850.00", date: new Date("2025-01-04"), accountId: "1" },
  ];

  const form = useForm<InsertTransaction>({
    resolver: zodResolver(insertTransactionSchema),
    defaultValues: {
      description: "",
      type: "saida",
      amount: "",
      category: "",
      date: new Date(),
      userId: "temp-user-id",
      accountId: "temp-account-id",
      autoRuleApplied: false,
    },
  });

  async function onSubmit(data: InsertTransaction) {
    try {
      // TODO: Implement transaction creation in Task 3
      console.log("Create transaction:", data);
      
      toast({
        title: "Transação criada!",
        description: `A transação foi adicionada com sucesso.`,
      });
      
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao criar transação",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  }

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-transactions-title">Transações</h1>
          <p className="text-muted-foreground" data-testid="text-transactions-subtitle">
            Gerencie todas as suas movimentações financeiras
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-transaction">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-transaction">
              <DialogHeader>
                <DialogTitle className="font-poppins">Adicionar Transação</DialogTitle>
                <DialogDescription>
                  Registre uma nova entrada ou saída
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Supermercado" 
                            data-testid="input-description"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="entrada">Entrada</SelectItem>
                              <SelectItem value="saida">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              data-testid="input-amount"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" data-testid="button-submit-transaction">
                      Adicionar Transação
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-filter-type">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card data-testid="card-transactions-list">
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTransactions.map((transaction, index) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-4 hover-elevate"
                  data-testid={`transaction-row-${index}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      transaction.type === "entrada" ? "bg-secondary/10" : "bg-destructive/10"
                    }`}>
                      {transaction.type === "entrada" ? (
                        <ArrowUpRight className="h-5 w-5 text-secondary" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" data-testid={`text-description-${index}`}>
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-category-${index}`}>
                          {transaction.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground" data-testid={`text-date-${index}`}>
                          {transaction.date.toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-right font-semibold whitespace-nowrap ml-4 ${
                    transaction.type === "entrada" ? "text-secondary" : "text-foreground"
                  }`} data-testid={`text-amount-${index}`}>
                    {transaction.type === "entrada" ? "+" : "-"}R$ {parseFloat(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
